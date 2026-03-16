# US-BE-003b: WebSocket relay - performance and resilience

**As a** platform operator
**I want to** the WebSocket relay to handle high concurrency, apply backpressure, and maintain keepalive
**So that** the relay remains stable under production load and detects stale connections

## Acceptance Criteria
- [ ] The relay handles at least 200 concurrent WebSocket connections without degradation (measured by message latency p99 < 100ms)
- [ ] Backpressure: if either side (frontend or daemon) is slow to consume frames, the relay buffers up to 1000 frames before dropping the connection with close code 1008 (Policy Violation) and logging a warning
- [ ] WebSocket ping/pong keepalive: the server sends a Ping frame every 30 seconds (configurable via `ws_keepalive_secs` in `hive.toml`); if no Pong is received within 10 seconds, the connection is closed
- [ ] Idle timeout: connections with no data frames in either direction for 5 minutes are closed with close code 1000 (Normal Closure)
- [ ] A load test script or benchmark is included that validates the 200-connection target using `tokio-tungstenite` or `websocat`
- [ ] Connection metrics are exposed: `hive_ws_connections_active` gauge, `hive_ws_frames_relayed_total` counter (if US-BE-028 is implemented; otherwise tracked internally)
- [ ] Memory usage per idle connection does not exceed 16KB (verified by benchmark)

## Technical Notes
- Extend the relay implementation in `crates/hive-server/src/ws_relay.rs` from US-BE-003a
- Backpressure: use a bounded `tokio::sync::mpsc` channel between the reader and writer tasks; when the channel is full, close the connection
- Keepalive: use `tokio::time::interval` in the frontend-to-daemon writer task to send Ping frames; track last Pong time with an `Arc<AtomicU64>` (epoch millis)
- Idle timeout: reset a shared timer on every data frame; use `tokio::time::sleep` with reset via `Pin<&mut Sleep>`
- Load test: add a `tests/ws_load.rs` integration test or a script in `scripts/ws-load-test.sh` using `tokio::spawn` to create N concurrent clients
- Split from US-BE-003; depends on US-BE-003a being implemented first

## Phase
Phase 1 (Skeleton + Room Proxy)
