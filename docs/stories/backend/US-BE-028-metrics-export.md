# US-BE-028: Prometheus metrics endpoint

**As a** platform operator
**I want to** scrape operational metrics from the Hive server via a Prometheus-compatible endpoint
**So that** I can monitor agent health, room activity, and connection counts in my existing observability stack

## Acceptance Criteria
- [ ] `GET /metrics` returns metrics in Prometheus text exposition format (`text/plain; version=0.0.4; charset=utf-8`)
- [ ] Exposed gauges: `hive_agents_running` (current running agent count), `hive_rooms_active` (current room count), `hive_ws_connections_active` (current WebSocket connection count)
- [ ] Exposed counters: `hive_http_requests_total` (labeled by method, path, status), `hive_errors_total` (labeled by error_type), `hive_agents_spawned_total`, `hive_agents_stopped_total`
- [ ] Exposed histograms: `hive_http_request_duration_seconds` (labeled by method, path)
- [ ] The `/metrics` endpoint does not require authentication (standard for Prometheus scrape targets)
- [ ] Metrics are updated in real time; gauge values reflect current state, not cached snapshots
- [ ] The endpoint responds within 50ms under normal load

## Technical Notes
- Implement in `crates/hive-server/src/metrics.rs`
- Use the `metrics` crate with `metrics-exporter-prometheus` for the exposition endpoint
- Register metrics in `AppState` initialization; instrument handlers with middleware or explicit `metrics::increment_counter!` / `metrics::gauge!` calls
- HTTP request metrics can be captured via an Axum middleware layer (e.g., `tower-http` metrics layer or a custom `Layer`)
- Agent and room gauges should read from `AgentRegistry` and room state directly rather than maintaining separate counters to avoid drift

## Phase
Phase 1 (Skeleton + Room Proxy)
