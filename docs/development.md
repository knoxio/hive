# Hive — Development Guide

## Prerequisites

- Rust toolchain 1.87+
- Node.js 20+
- pnpm (`npm install -g pnpm`)
- just (`cargo install just`)
- Docker + Docker Compose (for containerised dev)
- A running `room` daemon (see below)

## Quick Start

```bash
# Start everything via Docker (recommended)
just dev

# Or without Docker (room daemon must be on PATH)
just dev-local
```

## Repository Structure

```
hive/
├── crates/
│   └── hive-server/        # Rust/axum backend
│       ├── src/
│       │   ├── main.rs     # Route assembly, AppState
│       │   ├── auth.rs     # JWT auth
│       │   ├── db.rs       # SQLite schema + migrations
│       │   ├── rooms.rs    # Room CRUD + members
│       │   ├── ws_relay.rs # WebSocket relay to daemon
│       │   └── ...
│       └── Cargo.toml
├── hive-web/               # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── pages/          # Route-level components
│   │   └── lib/            # Shared utilities
│   ├── e2e/                # Playwright tests (run by CI)
│   └── package.json
├── docs/                   # Implementation docs (you are here)
├── justfile                # Task runner recipes
└── docker-compose.yml
```

## Running the Backend

```bash
# From repo root
cargo run -p hive-server

# With custom config
HIVE_PORT=3001 HIVE_DATA_DIR=/tmp/hive cargo run -p hive-server
```

The server starts on `http://localhost:3000` by default.

**Environment variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `HIVE_HOST` | `0.0.0.0` | Bind address |
| `HIVE_PORT` | `3000` | HTTP port |
| `HIVE_DATA_DIR` | `./data` | Directory for SQLite db and config |
| `HIVE_JWT_SECRET` | (random) | HS256 signing secret — set explicitly in production |
| `HIVE_DAEMON_WS_URL` | `ws://localhost:4242` | Room daemon WebSocket URL |

## Running the Frontend

```bash
cd hive-web
pnpm install
pnpm dev   # starts on http://localhost:5173
```

The dev server proxies `/api/*` and `/ws/*` to `localhost:3000`.

## Running Tests

```bash
# All tests (Rust + frontend lint + e2e)
just test

# Rust unit tests only
cargo test -p hive-server

# Frontend lint
cd hive-web && pnpm lint

# TypeScript type check
cd hive-web && pnpm tsc --noEmit

# Playwright e2e (requires running backend)
cd hive-web && pnpm playwright test
```

## Format + Lint

```bash
# Rust: format + clippy + test
just check

# Frontend: ESLint
cd hive-web && pnpm lint

# Auto-fix
cd hive-web && pnpm lint --fix
```

## Adding a New Backend Endpoint

1. **Define types** in the relevant module (or create `src/myfeature.rs`)
2. **Write the handler** — signature `async fn my_handler(State(state): State<Arc<AppState>>, ...) -> Result<Json<Response>, HiveError>`
3. **Add the route** in `main.rs`: `.route("/api/my-path", get(myfeature::my_handler))`
4. **Write Rust unit tests** in a `#[cfg(test)]` block using `Database::open_memory()`
5. **Write e2e tests** in `hive-web/e2e/my-feature.spec.ts`

### Example: minimal handler

```rust
// src/myfeature.rs
use axum::{extract::State, Json};
use std::sync::Arc;
use crate::{AppState, error::HiveError};

/// GET /api/my-feature — returns something useful.
pub async fn get_thing(State(state): State<Arc<AppState>>) -> Result<Json<serde_json::Value>, HiveError> {
    // ... query state.db
    Ok(Json(serde_json::json!({ "ok": true })))
}
```

```rust
// in main.rs protected_routes:
.route("/api/my-feature", get(myfeature::get_thing))
```

## Adding a New Frontend Component

1. Create `hive-web/src/components/MyComponent.tsx`
2. Add a module-level JSDoc comment explaining what the component does
3. Define a typed props interface
4. Export the component as a named export (`export function MyComponent(...)`)
5. Add `data-testid` attributes to key elements for e2e testing
6. Write e2e tests in `hive-web/e2e/my-component.spec.ts`

### Component checklist

- [ ] Module-level JSDoc or comment block
- [ ] Props interface with JSDoc on each prop
- [ ] `data-testid` on interactive and testable elements
- [ ] No `as any` or `as unknown as Type` casts
- [ ] No `eslint-disable` comments — fix the underlying issue
- [ ] No synchronous `setState` calls in `useEffect`/`useLayoutEffect` bodies
- [ ] No `Date.now()` or random values in render body (lint: `react-hooks/purity`)

## Adding a Database Migration

See [database-schema.md](database-schema.md#adding-a-migration).

## CI

CI runs on all PRs via GitHub Actions. Two jobs:

1. **Backend (Rust)**: `cargo fmt --check`, `cargo clippy -- -D warnings`, `cargo test`
2. **Frontend (React)**: `pnpm lint`, `pnpm build` (includes `tsc -b`)

**CI must pass before merging.** Never push with `--no-verify` unless prepared to fix immediately after.

## Debugging

### Backend logs

```bash
RUST_LOG=debug cargo run -p hive-server
```

### Frontend network inspector

Open browser DevTools → Network → filter by `api/` or `ws` to see requests.

### Playwright test debugging

```bash
cd hive-web
pnpm playwright test --debug          # opens inspector
pnpm playwright test --ui             # opens Playwright UI mode
pnpm playwright show-report           # view last test report
```
