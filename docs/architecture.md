# Hive — Architecture Overview

## System Diagram

```
┌─────────────────────────────────────────────────────┐
│                    Browser / Tauri                   │
│                                                     │
│  hive-web (React + TypeScript + Tailwind)           │
│  • REST API calls via fetch()                       │
│  • WebSocket connection for real-time chat          │
└──────────────────┬──────────────────────────────────┘
                   │ HTTP + WebSocket
                   ▼
┌─────────────────────────────────────────────────────┐
│               hive-server  (Rust + axum)            │
│  ┌───────────────────────────────────────────────┐  │
│  │  Public routes (no auth)                     │  │
│  │  GET  /api/health                            │  │
│  │  POST /api/auth/login                        │  │
│  │  GET  /api/setup/*                           │  │
│  │  GET  /ws/{room_id}?token=<jwt>              │  │
│  └───────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────┐  │
│  │  Protected routes (JWT required)             │  │
│  │  GET  /api/auth/me                           │  │
│  │  GET  /api/users/me                          │  │
│  │  *    /api/users/me/preferences              │  │
│  │  POST /api/auth/logout                       │  │
│  │  GET  /api/users, POST, PATCH, DELETE        │  │
│  │  GET  /api/rooms, POST                       │  │
│  │  GET  /api/rooms/:id, PATCH, DELETE          │  │
│  │  GET  /api/rooms/:id/members                 │  │
│  │  GET  /api/rooms/:id/messages                │  │
│  │  POST /api/rooms/:id/send                    │  │
│  │  POST /api/rooms/:id/join                    │  │
│  │  POST /api/rooms/:id/leave                   │  │
│  │  GET  /api/settings, PATCH                   │  │
│  │  GET  /api/settings/history                  │  │
│  │  GET  /api/agents                            │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  SQLite (hive.db)          JWT auth middleware      │
└──────────────────┬──────────────────────────────────┘
                   │ WebSocket (room protocol)
                   ▼
┌─────────────────────────────────────────────────────┐
│          Room Daemon  (room-cli v3.0.0)             │
│  • Multi-agent coordination                         │
│  • Message persistence                              │
│  • Presence tracking                                │
│  • Token-based auth                                 │
└─────────────────────────────────────────────────────┘
```

## Components

### hive-web (Frontend)

React 19 single-page application built with Vite.

**Key directories:**
- `src/components/` — UI components (ChatTimeline, MemberPanel, MessageInput, etc.)
- `src/hooks/` — React hooks encapsulating logic (useWebSocket, useConnectionStatus, useMessageHistory, useAuth, useRooms)
- `src/lib/` — Shared utilities (apiError, auth token helpers)
- `src/pages/` — Route-level components (LoginPage, UsersPage, ProfilePage, etc.)
- `e2e/` — Playwright end-to-end tests

**State management:**
- No global state library — React hooks + context only
- `AuthContext` provides the current user and token
- `useWebSocket` manages the WebSocket lifecycle per room
- `useMessageHistory` handles cursor-based history loading
- URL (`/rooms/:room_id`) is the source of truth for selected room

**WebSocket auth:**
The browser WebSocket API cannot set the `Authorization` header during upgrade.
The JWT is passed as `?token=<jwt>` in the WebSocket URL. The server validates it
and never forwards it to the room daemon.

### hive-server (Backend)

Rust/axum HTTP + WebSocket server. Two concerns:

1. **REST API** — CRUD for rooms, users, settings, agents. Backed by SQLite.
2. **WebSocket relay** — Bridges frontend WebSocket connections to the room daemon.

**Module map:**
| File | Responsibility |
|------|---------------|
| `main.rs` | Route assembly, AppState, server startup |
| `auth.rs` | JWT issuance + validation, login/logout, auth middleware |
| `db.rs` | SQLite schema, migrations, `Database` handle |
| `rooms.rs` | Room CRUD + member management |
| `ws_relay.rs` | Frontend ↔ daemon WebSocket relay |
| `rest_proxy.rs` | Proxied REST endpoints (room messages, single room) |
| `daemon.rs` | Upstream daemon WS config + backoff |
| `config.rs` | TOML config loading with env var overrides |
| `agents.rs` | Agent list endpoint |
| `admin.rs` | User management (list, create, patch, delete) |
| `users.rs` | `/api/users/me` profile endpoint |
| `preferences.rs` | Per-user preference storage |
| `settings.rs` | App-wide settings with change history |
| `setup.rs` | First-run setup wizard endpoints |
| `error.rs` | `HiveError` type and HTTP status code mapping |

### Room Daemon

External process (`room` binary from `room-cli` v3.0.0). Not part of this repo.
Co-located with hive-server; communicates over a local WebSocket.

**Responsibilities:**
- Room message persistence (chat history)
- Presence tracking (who is connected to which room)
- Token-based auth for agent joins
- Forwarding messages between clients

## Data Flow

### REST Request

```
Browser → fetch("/api/rooms", {headers: {Authorization: "Bearer <jwt>"}})
        → axum auth_middleware validates JWT
        → rooms::list_rooms handler
        → Database::query(SQLite)
        → JSON response
```

### WebSocket Message (outbound)

```
User types message → MessageInput
                   → sendMessage("{type: 'message', content: '...'}")
                   → hive-server ws_relay
                   → room daemon WebSocket
                   → daemon broadcasts to all room subscribers
```

### WebSocket Message (inbound)

```
Daemon broadcasts → hive-server ws_relay
                  → forwarded to frontend WebSocket
                  → useWebSocket hook parses JSON
                  → messages state updated
                  → ChatTimeline re-renders
```

### Room Selection + History

```
User clicks room → URL changes to /rooms/:room_id
                 → useWebSocket opens new connection to /ws/:room_id?token=...
                 → useMessageHistory fetches /api/rooms/:id/messages?limit=50
                 → App merges historyMessages + wsMessages into allMessages
                 → ChatTimeline key={roomId} remounts with merged messages
```

## Authentication

1. **Login**: `POST /api/auth/login` with `{username, password}` → JWT (HS256, 24h expiry)
2. **Token storage**: `localStorage['hive-auth-token']`
3. **Protected routes**: `Authorization: Bearer <token>` header on all API calls
4. **WebSocket**: `?token=<jwt>` query param (browser limitation)
5. **Logout**: `POST /api/auth/logout` → JWT added to `revoked_tokens` table
6. **Middleware**: `axum::middleware::from_fn` on all protected routes

## Database

SQLite at `<data_dir>/hive.db` (default `./data/hive.db`).
See [database-schema.md](database-schema.md) for the full schema.

## Configuration

`hive-server` reads config from (in order):
1. `hive.toml` in the working directory
2. Environment variables (`HIVE_HOST`, `HIVE_PORT`, `HIVE_DATA_DIR`, `HIVE_JWT_SECRET`, `HIVE_DAEMON_WS_URL`)

See `crates/hive-server/src/config.rs` for all options.
