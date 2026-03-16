# US-BE-003: WebSocket relay

**As a** Hive frontend user
**I want to** connect to a room via the Hive server's WebSocket endpoint
**So that** I receive real-time messages from the room daemon without connecting to it directly

## Acceptance Criteria
- [ ] `GET /ws/:room_id` upgrades to a WebSocket connection and relays frames bidirectionally to the room daemon at `ws://<daemon_host>/ws/:room_id`
- [ ] Text frames from the frontend are forwarded to the daemon unchanged
- [ ] Text frames from the daemon are forwarded to the frontend unchanged
- [ ] Binary frames are forwarded unchanged
- [ ] When the daemon connection closes, the frontend connection is closed with the same close code
- [ ] When the frontend disconnects, the daemon connection is torn down cleanly
- [ ] Connection errors to the daemon return an HTTP `502 Bad Gateway` before the WebSocket upgrade completes
- [ ] Relay handles at least 100 concurrent connections without degradation

## Technical Notes
- Implement in `crates/hive-server/src/ws_relay.rs`
- Use `tokio-tungstenite` to open the upstream daemon WebSocket connection
- Use axum's `WebSocketUpgrade` extractor for the frontend-facing side
- Spawn two tasks per relay session: one for each direction; both tasks share a cancellation token so either side closing tears down the other
- Daemon WebSocket URL is derived from `config.room_ws_url` (e.g. `ws://127.0.0.1:4200/ws/<room_id>`)
- No message transformation in Phase 1; raw relay only

## Clarifications (Sprint 19 Review)

- **Connection timeout**: 5 second timeout for the initial WebSocket handshake with the room daemon. If the daemon does not complete the upgrade within 5s, return `502 Bad Gateway` to the frontend.
- **Retry strategy**: On daemon disconnect during an active relay session, reconnect using exponential backoff: 1s, 2s, 4s, 8s, capped at 30s. During reconnection attempts, buffer frontend-bound messages (see backpressure). If the daemon remains unreachable after the max backoff interval, close the frontend connection with a `1011 Internal Error` close code.
- **Backpressure**: Maintain a 1000-message buffer per client for daemon-to-frontend delivery. On overflow, drop the oldest messages and emit a warning-level log entry including the room ID and number of dropped messages. Do not disconnect the client on overflow.
- **Keepalive**: Send WebSocket ping frames to the daemon every 30 seconds. If 3 consecutive pongs are missed (90s total), consider the daemon connection dead — close it and initiate the retry strategy above.
- **Message ordering**: Preserve message order within a single room relay session. No ordering guarantee is made across different room connections (i.e., if a client is relayed to multiple rooms via separate WebSocket connections).

## Phase
Phase 1 (Skeleton + Room Proxy)
