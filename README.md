# Hive

AI agent team orchestration platform built on [room](https://github.com/knoxio/room).

Hive provides a web dashboard and desktop application for managing teams of AI agents
coordinating through room's multi-agent infrastructure.

## Architecture

- **hive-server** — Rust/axum backend that proxies to a co-located room daemon via WebSocket
- **hive-web** — React web dashboard (Phase 1: web, Phase 2: Tauri desktop wrapper)

## Status

Phase 1 foundation shipped — backend server (health, config, WS relay, SQLite, error handling) and frontend scaffold (React three-panel layout, WebSocket hook, room list, chat timeline, member panel, message input). PRDs and 65+ user stories in `docs/`.

## Tech Stack

| Component | Technology | Rationale |
|-----------|-----------|-----------|
| Backend | Rust + axum | Shared types with room-protocol, proven in room-daemon |
| Frontend | React | Largest Tauri ecosystem, most hiring pool |
| Desktop | Tauri (Phase 2) | Same web frontend, native webview, 10MB installer |
| Database | SQLite | Single-host, no external deps |
| Transport | WebSocket | Real-time bidirectional, already shipped in room |

## Dependencies

- [room-protocol](https://crates.io/crates/room-protocol) — Wire format types and Plugin trait
- [room](https://github.com/knoxio/room) — Multi-agent coordination daemon (co-located)

## Documentation

- `docs/prd/` — Product requirement documents
- `docs/stories/` — User stories (33+ backend + 24+ frontend)

## Development

```bash
# Prerequisites: Rust toolchain, Node.js 20+, pnpm

# Backend
cargo build -p hive-server
cargo run -p hive-server           # starts on port 3000

# Frontend
cd hive-web && pnpm install && pnpm dev   # starts on port 5173

# Full stack via Docker
docker compose up --build          # room-daemon + hive-server + hive-web
```

## License

MIT
