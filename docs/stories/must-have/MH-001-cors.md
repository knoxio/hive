# MH-001: CORS on all API endpoints

**As a** frontend developer
**I want to** have CORS headers correctly configured on all Hive backend API endpoints
**So that** the browser-based frontend can make API requests without being blocked by the same-origin policy

## Complexity
S — Standard middleware configuration; no business logic involved, but must cover all route groups including WebSocket upgrade paths

## Priority
P0 — Without CORS the frontend cannot communicate with the backend at all; blocks all other frontend work

## Dependencies
- Hive backend HTTP server must be running (axum or equivalent)
- No story dependencies — this is foundational infrastructure

## Acceptance Criteria
- [ ] All `/api/*` routes return `Access-Control-Allow-Origin` header matching the configured allowed origins
- [ ] Preflight `OPTIONS` requests return HTTP 204 with correct `Access-Control-Allow-Methods` and `Access-Control-Allow-Headers`
- [ ] `Authorization`, `Content-Type`, and `X-Request-ID` headers are included in `Access-Control-Allow-Headers`
- [ ] Allowed origins are configurable via environment variable (e.g. `HIVE_CORS_ORIGINS`); defaults to `http://localhost:5173` for dev
- [ ] Wildcard origin (`*`) is explicitly forbidden in production mode (enforced at startup)
- [ ] WebSocket upgrade endpoint (`/ws/*`) does not strip `Origin` header before upgrade
- [ ] Integration test confirms a cross-origin preflight request receives a 204 with correct headers

## Technical Notes
- Use tower-http `CorsLayer` for axum; configure per-route or globally via `Router::layer`
- Origins list should support comma-separated values in the env var
- Log a warning at startup if `HIVE_CORS_ORIGINS` is not set and environment is not development
- Do not rely on the browser to enforce origin restrictions — validate `Origin` header server-side for sensitive mutation endpoints
