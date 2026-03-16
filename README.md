# Hive

AI agent team orchestration platform built on [room](https://github.com/knoxio/room).

Hive provides a web dashboard and desktop application for managing teams of AI agents
coordinating through room's multi-agent infrastructure.

## Architecture

- **hive-server** — Rust/axum backend that proxies to a co-located room daemon via WebSocket
- **hive-web** — React web dashboard (Phase 1: web, Phase 2: Tauri desktop wrapper)

## Status

Pre-alpha. PRDs and user stories are in `docs/`.

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
- `docs/stories/` — User stories (26 backend + 22 frontend)

## Development

```bash
# Prerequisites: Rust toolchain, Node.js 20+
cargo build -p hive-server
cd hive-web && npm install && npm run dev
```

## License

MIT
