# MH-002: Docker dev setup works out of the box

**As a** new contributor
**I want to** run the full Hive stack with a single command
**So that** I can start developing without manually installing and configuring each service

## Complexity
M — Requires composing multiple services (backend, frontend dev server, daemon bridge, database); volume mounts and hot-reload need care

## Priority
P0 — Without a reproducible dev environment, onboarding is slow and environment-specific bugs proliferate

## Dependencies
- MH-001 (CORS) — frontend container must be in the allowed origins list
- Backend service must have a stable Dockerfile
- Frontend must have a Dockerfile or dev server entry point

## Acceptance Criteria
- [ ] Running `docker compose up` from the repo root starts all required services with no additional steps
- [ ] Frontend hot-reload works — editing a source file in the host filesystem is reflected in the browser within 5 seconds
- [ ] Backend recompiles and restarts automatically when Rust source files change (using `cargo watch` or equivalent)
- [ ] A `.env.example` file exists at the repo root with all required environment variables documented
- [ ] Copying `.env.example` to `.env` and running `docker compose up` produces a working system with no manual edits
- [ ] `docker compose down -v` cleanly removes all volumes and leaves no orphan containers
- [ ] Health check endpoints for all services are wired into the compose file so `docker compose ps` accurately reports service readiness
- [ ] README documents the one-command startup and lists prerequisites (Docker version, available ports)

## Technical Notes
- Use multi-stage Dockerfile for the backend to keep the dev image lean
- Mount `./src` into the frontend container; do not copy at build time for dev target
- Postgres (or chosen DB) should use a named volume so data survives `docker compose restart` but is wiped by `down -v`
- Backend should wait for DB readiness using a `depends_on` + `healthcheck` pattern, not a fixed sleep
- Expose ports: frontend on 5173, backend on 8080, DB on 5432 (configurable via `.env`)
- Consider a `compose.override.yml` for local overrides that is gitignored
