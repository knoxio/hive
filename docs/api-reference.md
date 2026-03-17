# Hive — API Reference

Base URL: `http://localhost:3000` (development)

All protected endpoints require `Authorization: Bearer <jwt>` header.
JSON bodies require `Content-Type: application/json`.

---

## Public Endpoints (no auth)

### `GET /api/health`

Returns server health status.

**Response `200`**
```json
{
  "status": "ok",
  "version": "0.1.0"
}
```

---

### `POST /api/auth/login`

Issues a JWT for a local user.

**Request**
```json
{ "username": "admin", "password": "secret" }
```

**Response `200`**
```json
{ "token": "<jwt>" }
```

**Errors:** `401` invalid credentials, `422` missing fields.

---

### `GET /api/setup/status`

Returns whether the server is configured (admin user created, daemon URL set).

**Response `200`**
```json
{ "configured": false }
```

---

### `POST /api/setup/verify-daemon`

Verifies connectivity to the room daemon WebSocket URL.

**Request**
```json
{ "url": "ws://localhost:4242" }
```

**Response `200`** — connection successful.
**Response `502`** — cannot reach daemon.

---

### `POST /api/setup/configure`

Sets the daemon URL during first-run setup.

**Request**
```json
{ "daemon_ws_url": "ws://localhost:4242" }
```

**Response `200`** — saved.

---

### `POST /api/setup/create-admin`

Creates the initial admin user.

**Request**
```json
{ "username": "admin", "password": "secret" }
```

**Response `201`** — admin created.
**Response `409`** — admin already exists.

---

### `POST /api/setup/complete`

Marks setup as complete. Returns `200` or `400` if not ready.

---

### `GET /ws/{room_id}?token=<jwt>`

WebSocket upgrade endpoint. Authenticated via `?token=` query parameter
(browser WebSocket API cannot set `Authorization` header).

Pairs the client WebSocket with an upstream connection to the room daemon.
Messages flow bidirectionally. The JWT `sub` (username) is injected as the
room handshake identity to the daemon.

---

## Protected Endpoints (JWT required)

### Auth

#### `GET /api/auth/me`

Returns the authenticated user's profile from the JWT claims.

**Response `200`**
```json
{ "sub": "1", "username": "admin", "role": "admin" }
```

---

#### `POST /api/auth/logout`

Revokes the current JWT.

**Response `200`** — token revoked.

---

### Users (current user)

#### `GET /api/users/me`

Returns the full profile for the authenticated user.

**Response `200`**
```json
{
  "id": 1,
  "username": "admin",
  "role": "admin",
  "created_at": "2026-01-01T00:00:00Z"
}
```

---

#### `GET /api/users/me/preferences`

Returns the current user's preferences.

**Response `200`**
```json
{ "theme": "dark", "notifications": true }
```
(empty `{}` if no preferences set)

---

#### `PATCH /api/users/me/preferences`

Updates the current user's preferences. Partial update — only supplied keys are changed.

**Request**
```json
{ "theme": "light" }
```

**Response `200`** — merged preferences.

---

### User Management (admin only)

#### `GET /api/users`

Lists all users.

**Query params:** `?limit=50&offset=0`

**Response `200`**
```json
{
  "users": [
    { "id": 1, "username": "admin", "role": "admin", "active": true, "created_at": "..." }
  ],
  "total": 1
}
```

---

#### `POST /api/users`

Creates a new user.

**Request**
```json
{ "username": "alice", "password": "secret", "role": "user" }
```

**Response `201`**
```json
{ "id": 2, "username": "alice", "role": "user" }
```

**Errors:** `409` username taken, `422` invalid fields.

---

#### `PATCH /api/users/{user_id}`

Updates a user. Partial update.

**Request**
```json
{ "role": "admin", "active": false }
```

**Response `200`** — updated user.
**Errors:** `404` user not found.

---

#### `DELETE /api/users/{user_id}`

Deletes a user.

**Response `204`** — deleted.
**Errors:** `404` not found, `409` cannot delete the last admin.

---

### Rooms

#### `GET /api/rooms`

Lists all rooms the user has joined.

**Response `200`**
```json
{
  "rooms": [
    {
      "id": "dev-room",
      "name": "dev-room",
      "display_name": "Dev Room",
      "description": "Main development channel",
      "workspace_id": 1,
      "workspace_name": "default",
      "added_at": "2026-01-01T00:00:00Z"
    }
  ],
  "total": 1
}
```

---

#### `POST /api/rooms`

Creates a new room and joins it.

**Request**
```json
{ "id": "my-room", "name": "my-room" }
```

**Response `201`**
```json
{ "id": "my-room", "name": "my-room", "workspace_id": 1, ... }
```

**Errors:** `409` room ID already exists.

---

#### `GET /api/rooms/{room_id}`

Returns a single room (proxied from daemon).

**Response `200`** — room object.
**Response `404`** — room not found.

---

#### `PATCH /api/rooms/{room_id}`

Updates a room's display name or description.

**Request** (all fields optional)
```json
{ "display_name": "Dev Room", "description": "Main dev channel" }
```

**Constraints:**
- `display_name`: max 80 chars
- `description`: max 280 chars

**Response `200`** — updated room.
**Errors:** `400` validation failure, `404` room not found.

---

#### `DELETE /api/rooms/{room_id}`

Deletes a room from the workspace.

**Response `204`** — deleted.
**Errors:** `404` room not found.

---

#### `GET /api/rooms/{room_id}/members`

Lists members in a room with presence information.

**Response `200`**
```json
{
  "members": [
    {
      "username": "alice",
      "display_name": "Alice",
      "role": "user",
      "presence": "online"
    }
  ]
}
```

---

#### `GET /api/rooms/{room_id}/messages`

Returns paginated message history (proxied from daemon).

**Query params:** `?before=<message_id>&limit=50`

**Response `200`**
```json
{
  "messages": [
    {
      "id": "msg-uuid",
      "type": "message",
      "room": "dev-room",
      "user": "alice",
      "content": "Hello",
      "ts": "2026-01-01T00:00:00Z",
      "seq": 42
    }
  ],
  "has_more": true
}
```

---

#### `POST /api/rooms/{room_id}/send`

Sends a message to a room via the daemon REST API.

**Request**
```json
{ "content": "Hello world" }
```

**Response `200`** — message queued.
**Errors:** `502` daemon unreachable.

---

#### `POST /api/rooms/{room_id}/join`

Joins a room (adds it to the user's room list).

**Response `200`** — joined.
**Response `409`** — already a member.

---

#### `POST /api/rooms/{room_id}/leave`

Leaves a room (removes it from the user's room list).

**Response `200`** — left.
**Response `404`** — not a member.

---

### App Settings

#### `GET /api/settings`

Returns current app settings.

**Response `200`**
```json
{
  "daemon_ws_url": "ws://localhost:4242",
  "setup_complete": "true"
}
```

---

#### `PATCH /api/settings`

Updates app settings. Partial update.

**Request**
```json
{ "daemon_ws_url": "ws://newhost:4242" }
```

**Response `200`** — updated settings.

---

#### `GET /api/settings/history`

Returns the settings change log.

**Response `200`**
```json
{
  "history": [
    {
      "id": 1,
      "key": "daemon_ws_url",
      "old_value": null,
      "new_value": "ws://localhost:4242",
      "changed_by": "admin",
      "changed_at": "2026-01-01T00:00:00Z"
    }
  ]
}
```

---

### Agents

#### `GET /api/agents`

Lists connected AI agents (those with `agent:true` in their presence data).

**Response `200`**
```json
{
  "agents": [
    {
      "username": "r2d2",
      "room": "dev-room",
      "status": "active",
      "health": "ok"
    }
  ]
}
```

---

## Error Format

All error responses use a consistent JSON body:

```json
{ "error": "human-readable message" }
```

| Status | Meaning |
|--------|---------|
| `400` | Bad request / validation failure |
| `401` | Missing or invalid JWT |
| `403` | Forbidden (insufficient role) |
| `404` | Resource not found |
| `409` | Conflict (duplicate resource) |
| `422` | Unprocessable entity (malformed request body) |
| `502` | Bad gateway (daemon unreachable) |
| `500` | Internal server error |
