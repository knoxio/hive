# Hive — Database Schema

SQLite database at `<data_dir>/hive.db` (default: `./data/hive.db`).

WAL mode enabled (`PRAGMA journal_mode=WAL`).
Foreign keys enforced (`PRAGMA foreign_keys=ON`).

**Note:** Room-side data (messages, tokens, subscriptions, presence) lives in the
room daemon's own storage — not in this database.

---

## Migration History

Schema version is tracked in `_migrations(version)`. Current version: **7**.

| Version | Description | Key changes |
|---------|-------------|-------------|
| 1 | Initial schema | `users`, `workspaces`, `workspace_rooms`, `api_keys`, `team_manifests` |
| 2 | App settings | `app_settings` key/value store |
| 3 | JWT auth | `local_users`, `revoked_tokens` |
| 4 | Settings history | `app_settings_history` |
| 5 | User activation | `local_users.active` column |
| 6 | User preferences | `user_preferences` |
| 7 | Room metadata | `workspace_rooms.display_name`, `workspace_rooms.description` |

---

## Tables

### `_migrations`

Tracks applied schema migrations.

| Column | Type | Notes |
|--------|------|-------|
| `version` | INTEGER PK | Migration version number |
| `applied_at` | TEXT | ISO datetime, default `datetime('now')` |

---

### `users`

OAuth user identities (legacy — pre-JWT auth, not actively used in current auth flow).

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK AUTOINCREMENT | |
| `provider` | TEXT NOT NULL | e.g. `"github"` |
| `provider_id` | TEXT NOT NULL | Provider-specific user ID |
| `email` | TEXT | Nullable |
| `display_name` | TEXT | Nullable |
| `room_token` | TEXT | Room daemon auth token |
| `created_at` | TEXT NOT NULL | ISO datetime |

**Constraint:** `UNIQUE(provider, provider_id)`

---

### `workspaces`

Logical groupings of rooms. Each user's rooms belong to a workspace.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK AUTOINCREMENT | |
| `name` | TEXT NOT NULL | Workspace name |
| `owner_id` | INTEGER NOT NULL | FK → `users(id)` |
| `created_at` | TEXT NOT NULL | ISO datetime |

---

### `workspace_rooms`

Maps rooms (by ID) to workspaces. Room membership is stored here.

| Column | Type | Notes |
|--------|------|-------|
| `workspace_id` | INTEGER NOT NULL | FK → `workspaces(id) ON DELETE CASCADE` |
| `room_id` | TEXT NOT NULL | Room identifier (e.g. `"dev-room"`) |
| `added_at` | TEXT NOT NULL | ISO datetime |
| `display_name` | TEXT | Human-readable room name (nullable, v7) |
| `description` | TEXT | Room description, max 280 chars (nullable, v7) |

**Primary key:** `(workspace_id, room_id)`

---

### `api_keys`

API keys for programmatic access (not currently exposed via UI).

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK AUTOINCREMENT | |
| `user_id` | INTEGER NOT NULL | FK → `users(id) ON DELETE CASCADE` |
| `key_hash` | TEXT NOT NULL UNIQUE | Hashed key value |
| `label` | TEXT | Nullable human label |
| `scopes` | TEXT NOT NULL | Default `'*'` (all scopes) |
| `created_at` | TEXT NOT NULL | ISO datetime |
| `expires_at` | TEXT | Nullable expiry |

---

### `team_manifests`

JSON manifests describing agent team compositions.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK AUTOINCREMENT | |
| `workspace_id` | INTEGER NOT NULL | FK → `workspaces(id) ON DELETE CASCADE` |
| `name` | TEXT NOT NULL | Manifest name |
| `manifest_json` | TEXT NOT NULL | JSON blob |
| `created_at` | TEXT NOT NULL | ISO datetime |
| `updated_at` | TEXT NOT NULL | ISO datetime |

---

### `app_settings`

Key/value store for application-wide settings (e.g. `daemon_ws_url`, `setup_complete`).

| Column | Type | Notes |
|--------|------|-------|
| `key` | TEXT PK | Setting name |
| `value` | TEXT NOT NULL | Setting value (always string) |
| `updated_at` | TEXT NOT NULL | ISO datetime |
| `updated_by` | TEXT | Username of last editor, nullable |

---

### `app_settings_history`

Audit log of every settings change.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK AUTOINCREMENT | |
| `key` | TEXT NOT NULL | Setting name |
| `old_value` | TEXT | Nullable (null on first set) |
| `new_value` | TEXT NOT NULL | New value |
| `changed_by` | TEXT NOT NULL | Default `'system'` |
| `changed_at` | TEXT NOT NULL | ISO datetime |

---

### `local_users`

User accounts for JWT-based authentication. This is the primary auth table.

| Column | Type | Notes |
|--------|------|-------|
| `id` | INTEGER PK AUTOINCREMENT | |
| `username` | TEXT NOT NULL UNIQUE | Login name |
| `password_hash` | TEXT NOT NULL | bcrypt hash |
| `role` | TEXT NOT NULL | `'admin'` or `'user'`, default `'user'` |
| `active` | INTEGER NOT NULL | `1` = active, `0` = deactivated, default `1` (v5) |
| `created_at` | TEXT NOT NULL | ISO datetime |

---

### `revoked_tokens`

JWT revocation list. Checked on every authenticated request.

| Column | Type | Notes |
|--------|------|-------|
| `jti` | TEXT PK | JWT ID claim |
| `user_id` | INTEGER | Nullable (which user revoked it) |
| `expires_at` | TEXT NOT NULL | Token expiry — used for cleanup |
| `revoked_at` | TEXT NOT NULL | ISO datetime |

---

### `user_preferences`

Per-user JSON preferences blob (theme, notification settings, etc.).

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | INTEGER PK | FK → `local_users(id) ON DELETE CASCADE` |
| `prefs_json` | TEXT NOT NULL | JSON object, default `'{}'` |
| `updated_at` | TEXT NOT NULL | ISO datetime |

---

## Entity Relationship (simplified)

```
local_users ─────────────────── user_preferences
     │                          (1:1)
     │ (owner_id)
     ▼
workspaces ──────── workspace_rooms
     │              (workspace_id, room_id)
     │              .display_name
     │              .description
     │ (workspace_id)
     ▼
team_manifests
```

---

## Adding a Migration

1. Define `const SCHEMA_VN: &str = r#"..."#;` in `db.rs`
2. Bump `const SCHEMA_VERSION: i64 = N;`
3. Add `if current < N { ... }` guard after the previous version's guard in `migrate()`
4. Insert into `_migrations`: `conn.execute("INSERT INTO _migrations (version) VALUES (N)", [])?;`
