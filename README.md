# Hive

AI agent team orchestration platform built on [room](https://github.com/knoxio/room).

Hive provides a web dashboard for managing teams of AI agents
coordinating through room's multi-agent infrastructure.

## Architecture

- **crates/hive-server** — Rust/axum backend: REST API, JWT auth, SQLite, WebSocket relay to room daemon
- **hive-web** — React + TypeScript + Tailwind frontend (Vite, SPA)

See [docs/architecture.md](docs/architecture.md) for the full system diagram and data flow.

## Tech Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Backend | Rust + axum | Shared types with room-protocol, proven in room-daemon |
| Frontend | React + Vite + TypeScript | Fast HMR, type-safe, Tauri-compatible |
| Styling | Tailwind CSS | Utility-first, fast iteration |
| Desktop | Tauri (Phase 2) | Same web frontend, native webview |
| Database | SQLite | Single-host, no external deps |
| Transport | WebSocket | Real-time bidirectional, already shipped in room |
| Package manager | pnpm | Faster, stricter than npm |
| Task runner | just | Single dev command, cross-platform |

## Prerequisites

- Rust toolchain (1.87+)
- Node.js 20+
- [pnpm](https://pnpm.io/) (`npm install -g pnpm`)
- [just](https://github.com/casey/just) (`cargo install just`)
- Docker + Docker Compose (for containerized dev)

## Quick Start

```bash
# One command — starts everything via Docker with hot reload
just dev

# Or without Docker (requires room daemon on PATH)
just dev-local
```

## Development

```bash
# Install just (task runner)
cargo install just

# Start full stack with Docker (hot reload enabled)
just dev

# Start without Docker
just dev-local

# Individual services
cargo run -p hive-server           # backend on port 3000
cd hive-web && pnpm install && pnpm dev   # frontend on port 5173

# Build
just build

# Test
just test

# Format + lint + test
just check
```

## Docker

```bash
# Production mode
docker compose up --build

# Development mode (hot reload for both frontend and backend)
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

## Dependencies

- [room-protocol](https://crates.io/crates/room-protocol) — Wire format types and Plugin trait
- [room](https://github.com/knoxio/room) — Multi-agent coordination daemon (co-located)
- [room-ralph](https://github.com/knoxio/room-ralph) — Agent execution wrapper

## Documentation

- [docs/architecture.md](docs/architecture.md) — System diagram and component overview
- [docs/api-reference.md](docs/api-reference.md) — All HTTP endpoints with request/response shapes
- [docs/database-schema.md](docs/database-schema.md) — SQLite schema, migration history
- [docs/development.md](docs/development.md) — Development guide: adding endpoints, components, tests
- [docs/websocket-protocol.md](docs/websocket-protocol.md) — WebSocket protocol, message format, reconnection
- [AGENTS.md](AGENTS.md) — Agent team coordination rules
- `docs/prd/` — Product requirement documents
- `docs/stories/` — User stories (must-have, should-have, can-have)

## License

MIT
