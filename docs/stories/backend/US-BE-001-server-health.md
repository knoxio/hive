# US-BE-001: Server health endpoint

**As a** platform operator
**I want to** query a health endpoint on the Hive server
**So that** load balancers and monitoring systems can determine whether the server is running and ready to accept traffic

## Acceptance Criteria
- [ ] `GET /api/health` returns `200 OK` with a JSON body containing at least `{"status": "ok"}`
- [ ] Response includes server version and uptime in seconds
- [ ] Response includes room daemon connectivity status (`daemon_connected: true/false`)
- [ ] Endpoint is unauthenticated (no token required)
- [ ] Response time is under 100ms under normal load
- [ ] Returns `503 Service Unavailable` with `{"status": "degraded", "reason": "..."}` when the room daemon is unreachable

## Technical Notes
- Implement in `crates/hive-server/src/main.rs` or a dedicated `health.rs` handler
- Daemon connectivity check: attempt a short-timeout ping to the room daemon WebSocket or REST `GET /api/health`; do not block on it — use a cached status updated every 5s
- Use `axum::Router` to register the route
- Uptime is calculated from a `start_time: std::time::Instant` stored in shared `AppState`

## Clarifications (Sprint 19 Review)

- **Daemon connectivity timeout**: 2 seconds. If the daemon does not respond to a health ping within 2s, report status as `"degraded"`.
- **Startup behavior**: The health endpoint returns `{"status": "starting"}` until the first successful daemon ping completes. This prevents load balancers from routing traffic before the server has confirmed daemon reachability.
- **Failure recovery**: After 3 consecutive daemon timeouts (each at the 2s threshold), report `{"status": "unhealthy", "error": "<detail>"}` instead of `"degraded"`. Reset the counter on any successful ping.
- **Cache TTL**: 5 seconds as specified in technical notes, but invalidate the cached status immediately upon receiving a daemon disconnect event (e.g., WebSocket close or TCP reset). The next health check triggers a fresh probe rather than serving stale `"ok"`.

## Phase
Phase 1 (Skeleton + Room Proxy)
