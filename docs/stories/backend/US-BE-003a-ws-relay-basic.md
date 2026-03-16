# US-BE-003a: WebSocket relay - basic message passing

**As a** Hive frontend user
**I want to** connect to a room via the Hive server's WebSocket endpoint with reliable bidirectional message relay
**So that** I receive real-time messages from the room daemon without connecting to it directly

## Acceptance Criteria
- [ ] `GET /ws/:room_id` upgrades to a WebSocket connection and relays frames bidirectionally to the room daemon at `ws://<daemon_host>/ws/:room_id`
- [ ] Text frames from the frontend are forwarded to the daemon unchanged
- [ ] Text frames from the daemon are forwarded to the frontend unchanged
- [ ] Binary frames are forwarded unchanged
- [ ] When the daemon connection closes, the frontend connection is closed with the same close code and reason
- [ ] When the frontend disconnects, the daemon connection is torn down cleanly (Close frame sent, resources freed)
- [ ] Connection errors to the daemon return HTTP `502 Bad Gateway` before the WebSocket upgrade completes
- [ ] If the daemon is unreachable at connect time, the error response includes a JSON body: `{"error":"room daemon unreachable","room_id":"<id>"}`
- [ ] Relay tasks are tracked in `AppState` so they can be cleaned up during graceful shutdown (US-BE-026)
- [ ] Each relay session logs connection open, close, and error events at `DEBUG` level with the room ID and client address

## Technical Notes
- Implement in `crates/hive-server/src/ws_relay.rs`
- Use `tokio-tungstenite` to open the upstream daemon WebSocket connection
- Use Axum's `WebSocketUpgrade` extractor for the frontend-facing side
- Spawn two tasks per relay session: one for each direction; both tasks share a `CancellationToken` so either side closing tears down the other
- Daemon WebSocket URL is derived from `config.room_ws_url` (e.g., `ws://127.0.0.1:4200/ws/<room_id>`)
- No message transformation in this story; raw relay only
- Split from US-BE-003; this story covers core relay functionality, US-BE-003b covers performance

## Phase
Phase 1 (Skeleton + Room Proxy)
