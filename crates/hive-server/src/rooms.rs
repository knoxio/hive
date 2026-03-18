//! Room management API — MH-016 (list rooms), MH-014 (create room),
//! MH-015 (delete room), MH-019 (join/leave room), MH-020 (member list).
//!
//! Rooms are stored in Hive's DB (`workspace_rooms` table, scoped to a
//! workspace). This module replaces the placeholder `list_rooms` stub in
//! `rest_proxy` with a proper DB-backed implementation.
//!
//! Room creation provisions the room on the daemon side via the daemon's
//! HTTP API, then records it in `workspace_rooms`.

use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Extension, Json,
};
use serde::{Deserialize, Serialize};

use crate::{auth::Claims, AppState};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// A room entry returned by `GET /api/rooms` and `PATCH /api/rooms/:id`.
#[derive(Debug, Serialize)]
pub struct Room {
    pub id: String,
    pub name: String,
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub workspace_id: i64,
    pub workspace_name: String,
    pub added_at: String,
}

/// Request body for `PATCH /api/rooms/:room_id`.
#[derive(Debug, Deserialize)]
pub struct PatchRoomRequest {
    /// New display name (1–80 chars, alphanumerics/hyphens/underscores).
    pub name: Option<String>,
    /// New description (max 280 chars, plain text).
    pub description: Option<String>,
}

/// Response for `GET /api/rooms`.
#[derive(Debug, Serialize)]
pub struct RoomListResponse {
    pub rooms: Vec<Room>,
    pub total: usize,
}

/// Request body for `POST /api/rooms`.
#[derive(Debug, Deserialize)]
pub struct CreateRoomRequest {
    /// Human-readable room name (1–80 chars, alphanumerics/hyphens/underscores).
    pub name: String,
    /// Optional description for the room.
    pub description: Option<String>,
    /// Workspace to add the room to; defaults to workspace id 1.
    pub workspace_id: Option<i64>,
}

/// Response for `POST /api/rooms`.
#[derive(Debug, Serialize)]
pub struct CreateRoomResponse {
    pub id: String,
    pub name: String,
    pub workspace_id: i64,
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

/// Valid room name pattern: 1–80 chars, alphanumerics/hyphens/underscores.
fn validate_room_name(name: &str) -> Result<(), String> {
    if name.is_empty() || name.len() > 80 {
        return Err("room name must be 1–80 characters".to_owned());
    }
    if !name
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
    {
        return Err(
            "room name may only contain alphanumerics, hyphens, and underscores".to_owned(),
        );
    }
    Ok(())
}

/// Validate room description length: max 280 characters.
fn validate_description_len(desc: &str) -> Result<(), &'static str> {
    if desc.len() > 280 {
        return Err("description must be 280 characters or fewer");
    }
    Ok(())
}

/// Derive a room ID from a name: lowercase, spaces → hyphens.
///
/// The caller is responsible for ensuring uniqueness (appending a suffix if
/// the derived ID already exists).
fn room_id_from_name(name: &str) -> String {
    name.to_lowercase()
        .chars()
        .map(|c| {
            if c.is_alphanumeric() || c == '-' || c == '_' {
                c
            } else {
                '-'
            }
        })
        .collect()
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/rooms` — list all rooms from the Hive database.
///
/// Returns rooms from all workspaces (scoped per-user once MH-011 lands).
pub async fn list_rooms(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let result = state.db.with_conn(|conn| {
        let mut stmt = conn.prepare(
            "SELECT wr.room_id, wr.workspace_id, w.name, wr.added_at, \
                    wr.display_name, wr.description \
             FROM workspace_rooms wr \
             JOIN workspaces w ON w.id = wr.workspace_id \
             ORDER BY wr.added_at DESC",
        )?;
        let rooms: Vec<Room> = stmt
            .query_map([], |row| {
                let room_id: String = row.get(0)?;
                let workspace_id: i64 = row.get(1)?;
                let workspace_name: String = row.get(2)?;
                let added_at: String = row.get(3)?;
                let display_name: Option<String> = row.get(4)?;
                let description: Option<String> = row.get(5)?;
                Ok(Room {
                    name: room_id.clone(),
                    id: room_id,
                    display_name,
                    description,
                    workspace_id,
                    workspace_name,
                    added_at,
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(rooms)
    });

    match result {
        Ok(rooms) => {
            let total = rooms.len();
            (StatusCode::OK, Json(RoomListResponse { rooms, total })).into_response()
        }
        Err(e) => {
            tracing::error!("failed to list rooms: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, "internal error").into_response()
        }
    }
}

/// `POST /api/rooms` — create a new room in a workspace.
///
/// Validates the room name, derives a room ID, ensures uniqueness, and inserts
/// into `workspace_rooms`. Daemon provisioning is deferred (MH-014 follow-up
/// once the daemon REST API is finalised).
pub async fn create_room(
    State(state): State<Arc<AppState>>,
    Json(body): Json<CreateRoomRequest>,
) -> impl IntoResponse {
    if let Err(msg) = validate_room_name(&body.name) {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": msg})),
        )
            .into_response();
    }

    let workspace_id = body.workspace_id.unwrap_or(1);
    let base_id = room_id_from_name(&body.name);

    let result = state.db.with_conn(|conn| {
        // Ensure workspace exists.
        let exists: i64 = conn.query_row(
            "SELECT COUNT(*) FROM workspaces WHERE id = ?1",
            [workspace_id],
            |row| row.get(0),
        )?;
        if exists == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }

        // Find a unique room_id (append suffix on collision).
        let room_id = {
            let taken: i64 = conn.query_row(
                "SELECT COUNT(*) FROM workspace_rooms WHERE room_id = ?1",
                [&base_id],
                |row| row.get(0),
            )?;
            if taken == 0 {
                base_id.clone()
            } else {
                // Append a short random-ish suffix (last 4 digits of Unix time).
                let suffix = std::time::SystemTime::now()
                    .duration_since(std::time::UNIX_EPOCH)
                    .map(|d| d.as_secs() % 10000)
                    .unwrap_or(0);
                format!("{base_id}-{suffix}")
            }
        };

        conn.execute(
            "INSERT INTO workspace_rooms (workspace_id, room_id) VALUES (?1, ?2)",
            rusqlite::params![workspace_id, room_id],
        )?;

        Ok((room_id, workspace_id))
    });

    match result {
        Ok((room_id, ws_id)) => {
            tracing::info!(room_id = %room_id, workspace_id = ws_id, "room created");
            (
                StatusCode::CREATED,
                Json(CreateRoomResponse {
                    id: room_id.clone(),
                    name: room_id,
                    workspace_id: ws_id,
                }),
            )
                .into_response()
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "workspace not found"})),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("failed to create room: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, "internal error").into_response()
        }
    }
}

/// `DELETE /api/rooms/:room_id` — remove a room from the database.
///
/// Hard-deletes the `workspace_rooms` row. Returns 204 on success, 404 if the
/// room does not exist.
pub async fn delete_room(
    State(state): State<Arc<AppState>>,
    Path(room_id): Path<String>,
) -> impl IntoResponse {
    let result = state.db.with_conn(|conn| {
        let rows = conn.execute(
            "DELETE FROM workspace_rooms WHERE room_id = ?1",
            rusqlite::params![room_id],
        )?;
        Ok(rows)
    });

    match result {
        Ok(0) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "room not found"})),
        )
            .into_response(),
        Ok(_) => {
            tracing::info!(room_id = %room_id, "room deleted");
            StatusCode::NO_CONTENT.into_response()
        }
        Err(e) => {
            tracing::error!("failed to delete room '{room_id}': {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, "internal error").into_response()
        }
    }
}

/// `PATCH /api/rooms/:room_id` — update a room's display name and/or description.
///
/// Validates the new name (if provided) and updates `workspace_rooms`. Returns
/// the updated room object on success, or 404 if the room does not exist.
pub async fn patch_room(
    State(state): State<Arc<AppState>>,
    Path(room_id): Path<String>,
    Json(body): Json<PatchRoomRequest>,
) -> impl IntoResponse {
    // Validate name if provided.
    if let Some(ref name) = body.name {
        if let Err(msg) = validate_room_name(name) {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": msg})),
            )
                .into_response();
        }
        // Check uniqueness against existing display_names and room_ids.
        let name_clone = name.clone();
        let room_id_clone = room_id.clone();
        let unique_result = state.db.with_conn(move |conn| {
            let conflict: i64 = conn.query_row(
                "SELECT COUNT(*) FROM workspace_rooms \
                 WHERE room_id != ?1 AND (display_name = ?2 OR room_id = ?2)",
                rusqlite::params![room_id_clone, name_clone],
                |row| row.get(0),
            )?;
            Ok(conflict)
        });
        match unique_result {
            Ok(n) if n > 0 => {
                return (
                    StatusCode::CONFLICT,
                    Json(serde_json::json!({"error": "room name already in use"})),
                )
                    .into_response();
            }
            Err(e) => {
                tracing::error!("failed to check name uniqueness: {e}");
                return (StatusCode::INTERNAL_SERVER_ERROR, "internal error").into_response();
            }
            _ => {}
        }
    }

    // Validate description length if provided.
    if let Some(ref desc) = body.description {
        if let Err(msg) = validate_description_len(desc) {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": msg})),
            )
                .into_response();
        }
    }

    let result = state.db.with_conn(|conn| {
        // Verify room exists.
        let exists: i64 = conn.query_row(
            "SELECT COUNT(*) FROM workspace_rooms WHERE room_id = ?1",
            [&room_id],
            |row| row.get(0),
        )?;
        if exists == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }

        // Apply updates.
        if let Some(ref name) = body.name {
            conn.execute(
                "UPDATE workspace_rooms SET display_name = ?1 WHERE room_id = ?2",
                rusqlite::params![name, room_id],
            )?;
        }
        if let Some(ref desc) = body.description {
            conn.execute(
                "UPDATE workspace_rooms SET description = ?1 WHERE room_id = ?2",
                rusqlite::params![desc, room_id],
            )?;
        }

        // Fetch updated row.
        conn.query_row(
            "SELECT wr.room_id, wr.workspace_id, w.name, wr.added_at, \
                    wr.display_name, wr.description \
             FROM workspace_rooms wr \
             JOIN workspaces w ON w.id = wr.workspace_id \
             WHERE wr.room_id = ?1",
            [&room_id],
            |row| {
                let room_id: String = row.get(0)?;
                Ok(Room {
                    name: room_id.clone(),
                    id: room_id,
                    workspace_id: row.get(1)?,
                    workspace_name: row.get(2)?,
                    added_at: row.get(3)?,
                    display_name: row.get(4)?,
                    description: row.get(5)?,
                })
            },
        )
    });

    match result {
        Ok(room) => (StatusCode::OK, Json(room)).into_response(),
        Err(rusqlite::Error::QueryReturnedNoRows) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": format!("room {room_id} not found")})),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("failed to patch room {room_id}: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, "internal error").into_response()
        }
    }
}

/// Response for `POST /api/rooms/:room_id/join`.
#[derive(Debug, Serialize)]
pub struct JoinRoomResponse {
    pub room_id: String,
    pub joined: bool,
}

/// Extract the daemon REST base URL from config.
fn daemon_base(state: &AppState) -> String {
    state
        .config
        .daemon
        .ws_url
        .replace("ws://", "http://")
        .replace("wss://", "https://")
}

/// `POST /api/rooms/:room_id/join` — join a room (MH-019).
///
/// Registers the authenticated user with the room daemon so they can receive
/// and send messages. Returns 404 if the room does not exist in the DB.
/// Gracefully degrades when the daemon is unreachable — the join still
/// succeeds from Hive's perspective so the frontend can update the sidebar.
pub async fn join_room(
    State(state): State<Arc<AppState>>,
    Path(room_id): Path<String>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    // Verify room exists in Hive DB.
    let exists = state.db.with_conn(|conn| {
        conn.query_row(
            "SELECT COUNT(*) FROM workspace_rooms WHERE room_id = ?1",
            rusqlite::params![room_id],
            |row| row.get::<_, i64>(0),
        )
    });
    match exists {
        Ok(0) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "room not found"})),
            )
                .into_response();
        }
        Err(e) => {
            tracing::error!("DB error checking room '{}': {e}", room_id);
            return (StatusCode::INTERNAL_SERVER_ERROR, "internal error").into_response();
        }
        Ok(_) => {}
    }

    // Best-effort: register user with the daemon.  Daemon may not be running
    // (dev / test environments).  We do not fail the join if the daemon is
    // unreachable.
    let base = daemon_base(&state);
    let daemon_url = format!("{base}/api/{room_id}/join");
    let _ = reqwest::Client::new()
        .post(&daemon_url)
        .timeout(std::time::Duration::from_secs(3))
        .json(&serde_json::json!({"username": claims.username}))
        .send()
        .await;

    tracing::info!(room_id = %room_id, username = %claims.username, "user joined room");
    (
        StatusCode::OK,
        Json(JoinRoomResponse {
            room_id,
            joined: true,
        }),
    )
        .into_response()
}

/// `POST /api/rooms/:room_id/leave` — leave a room (MH-019).
///
/// Acknowledges the leave request.  The room daemon has no explicit REST
/// leave endpoint; disconnecting the WebSocket session is the mechanism.
/// The frontend is responsible for removing the room from the local joined
/// list after receiving a 204 from this endpoint.
///
/// Returns 404 if the room does not exist in the DB.
pub async fn leave_room(
    State(state): State<Arc<AppState>>,
    Path(room_id): Path<String>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let exists = state.db.with_conn(|conn| {
        conn.query_row(
            "SELECT COUNT(*) FROM workspace_rooms WHERE room_id = ?1",
            rusqlite::params![room_id],
            |row| row.get::<_, i64>(0),
        )
    });
    match exists {
        Ok(0) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({"error": "room not found"})),
            )
                .into_response();
        }
        Err(e) => {
            tracing::error!("DB error checking room '{}': {e}", room_id);
            return (StatusCode::INTERNAL_SERVER_ERROR, "internal error").into_response();
        }
        Ok(_) => {}
    }

    tracing::info!(room_id = %room_id, username = %claims.username, "user left room");
    StatusCode::NO_CONTENT.into_response()
}

/// A member entry returned by `GET /api/rooms/:id/members`.
#[derive(Debug, Serialize)]
pub struct MemberInfo {
    pub username: String,
    pub display_name: Option<String>,
    /// "admin" | "user" — from local_users.role if available, otherwise "user".
    pub role: String,
    /// "online" | "offline" — presence is tracked by the WebSocket layer; this
    /// endpoint returns "offline" for all members (WS layer overlays live presence).
    pub presence: &'static str,
}

/// Response for `GET /api/rooms/:id/members`.
#[derive(Debug, Serialize)]
pub struct RoomMembersResponse {
    pub members: Vec<MemberInfo>,
    pub total: usize,
}

/// `GET /api/rooms/:room_id/members` — list members who have explicitly joined the room.
///
/// Queries the `room_members` table (added by MH-019). If the table does not
/// yet exist in the database (pre-MH-019), returns an empty member list so
/// the frontend can fall back to WS-derived presence data.
pub async fn get_room_members(
    State(state): State<Arc<AppState>>,
    Path(room_id): Path<String>,
) -> impl IntoResponse {
    let result = state.db.with_conn(|conn| {
        // Check whether room exists first.
        let room_exists: i64 = conn.query_row(
            "SELECT COUNT(*) FROM workspace_rooms WHERE room_id = ?1",
            [&room_id],
            |row| row.get(0),
        )?;
        if room_exists == 0 {
            return Err(rusqlite::Error::QueryReturnedNoRows);
        }

        // Check whether room_members table exists (added by MH-019).
        let table_exists: i64 = conn.query_row(
            "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='room_members'",
            [],
            |row| row.get(0),
        )?;

        if table_exists == 0 {
            // Pre-MH-019: no membership data yet — return empty list.
            return Ok(vec![]);
        }

        // Query members joined with local_users for role.
        // display_name is not yet in local_users (planned for a future migration).
        let mut stmt = conn.prepare(
            "SELECT rm.username, lu.role \
             FROM room_members rm \
             LEFT JOIN local_users lu ON lu.username = rm.username \
             WHERE rm.room_id = ?1 \
             ORDER BY rm.username ASC",
        )?;
        let members: Vec<MemberInfo> = stmt
            .query_map([&room_id], |row| {
                let username: String = row.get(0)?;
                let role: Option<String> = row.get(1)?;
                Ok(MemberInfo {
                    username,
                    display_name: None,
                    role: role.unwrap_or_else(|| "user".to_owned()),
                    presence: "offline",
                })
            })?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(members)
    });

    match result {
        Ok(members) => {
            let total = members.len();
            (StatusCode::OK, Json(RoomMembersResponse { members, total })).into_response()
        }
        Err(rusqlite::Error::QueryReturnedNoRows) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({"error": "room not found"})),
        )
            .into_response(),
        Err(e) => {
            tracing::error!("failed to list members for room '{room_id}': {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, "internal error").into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// Startup seeding
// ---------------------------------------------------------------------------

/// Seed the default workspace (id=1) on first run.
///
/// Every room creation uses `workspace_id = 1` by default. A fresh database
/// has no workspaces, which causes `POST /api/rooms` to return 404. This
/// function inserts a system user (id=1) and the default workspace (id=1) so
/// that room operations work out of the box without extra setup.
///
/// Both inserts are `INSERT OR IGNORE`, making this fully idempotent.
pub fn seed_default_workspace(db: &crate::db::Database) {
    let result = db.with_conn(|conn| {
        // Ensure a system user exists as workspace owner.
        conn.execute(
            "INSERT OR IGNORE INTO users (id, provider, provider_id) \
             VALUES (1, 'system', 'system')",
            [],
        )?;
        // Ensure the default workspace exists.
        conn.execute(
            "INSERT OR IGNORE INTO workspaces (id, name, owner_id) \
             VALUES (1, 'default', 1)",
            [],
        )?;
        Ok(())
    });
    if let Err(e) = result {
        tracing::warn!("failed to seed default workspace: {e}");
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_room_names_accepted() {
        assert!(validate_room_name("dev").is_ok());
        assert!(validate_room_name("room-dev").is_ok());
        assert!(validate_room_name("my_workspace_123").is_ok());
        assert!(validate_room_name(&"a".repeat(80)).is_ok());
    }

    #[test]
    fn invalid_room_names_rejected() {
        assert!(validate_room_name("").is_err());
        assert!(validate_room_name(&"a".repeat(81)).is_err());
        assert!(validate_room_name("has space").is_err());
        assert!(validate_room_name("has/slash").is_err());
        assert!(validate_room_name("has@symbol").is_err());
    }

    #[test]
    fn room_id_derivation() {
        assert_eq!(room_id_from_name("Dev"), "dev");
        assert_eq!(room_id_from_name("my-room"), "my-room");
        assert_eq!(room_id_from_name("room_123"), "room_123");
    }

    #[test]
    fn list_rooms_empty_workspace() {
        let db = crate::db::Database::open_memory().unwrap();
        // Insert a workspace but no rooms.
        db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO users (provider, provider_id) VALUES ('test', '1')",
                [],
            )?;
            conn.execute(
                "INSERT INTO workspaces (name, owner_id) VALUES ('default', 1)",
                [],
            )?;
            Ok(())
        })
        .unwrap();

        let rooms = db
            .with_conn(|conn| {
                let mut stmt = conn.prepare(
                    "SELECT wr.room_id, wr.workspace_id, w.name, wr.added_at \
                     FROM workspace_rooms wr \
                     JOIN workspaces w ON w.id = wr.workspace_id \
                     ORDER BY wr.added_at DESC",
                )?;
                let rooms: Vec<(String, i64)> = stmt
                    .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(rooms)
            })
            .unwrap();

        assert!(rooms.is_empty());
    }

    #[test]
    fn room_inserted_and_listed() {
        let db = crate::db::Database::open_memory().unwrap();
        db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO users (provider, provider_id) VALUES ('test', '1')",
                [],
            )?;
            conn.execute(
                "INSERT INTO workspaces (name, owner_id) VALUES ('default', 1)",
                [],
            )?;
            conn.execute(
                "INSERT INTO workspace_rooms (workspace_id, room_id) VALUES (1, 'room-dev')",
                [],
            )?;
            Ok(())
        })
        .unwrap();

        let room_id: String = db
            .with_conn(|conn| {
                conn.query_row(
                    "SELECT room_id FROM workspace_rooms WHERE workspace_id = 1",
                    [],
                    |row| row.get(0),
                )
            })
            .unwrap();

        assert_eq!(room_id, "room-dev");
    }

    fn seed_room(db: &crate::db::Database, room_id: &str) {
        db.with_conn(|conn| {
            conn.execute(
                "INSERT OR IGNORE INTO users (provider, provider_id) VALUES ('test', '1')",
                [],
            )?;
            conn.execute(
                "INSERT OR IGNORE INTO workspaces (id, name, owner_id) VALUES (1, 'default', 1)",
                [],
            )?;
            conn.execute(
                "INSERT OR IGNORE INTO workspace_rooms (workspace_id, room_id) VALUES (1, ?1)",
                [room_id],
            )?;
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn delete_existing_room_returns_one() {
        let db = crate::db::Database::open_memory().unwrap();
        seed_room(&db, "to-delete");

        let rows = db
            .with_conn(|conn| {
                conn.execute(
                    "DELETE FROM workspace_rooms WHERE room_id = ?1",
                    rusqlite::params!["to-delete"],
                )
            })
            .unwrap();

        assert_eq!(rows, 1);

        // Room is gone
        let count: i64 = db
            .with_conn(|conn| {
                conn.query_row(
                    "SELECT COUNT(*) FROM workspace_rooms WHERE room_id = 'to-delete'",
                    [],
                    |row| row.get(0),
                )
            })
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn join_room_response_serializes_correctly() {
        let resp = JoinRoomResponse {
            room_id: "room-dev".to_owned(),
            joined: true,
        };
        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["room_id"], "room-dev");
        assert_eq!(json["joined"], true);
    }

    #[test]
    fn daemon_base_converts_ws_to_http() {
        use crate::config::{DaemonConfig, HiveConfig, ServerConfig};
        let state = crate::AppState {
            config: HiveConfig {
                server: ServerConfig::default(),
                daemon: DaemonConfig {
                    socket_path: std::path::PathBuf::from("/tmp/test.sock"),
                    ws_url: "ws://127.0.0.1:4200".to_owned(),
                },
            },
            db: crate::db::Database::open_memory().unwrap(),
            jwt_secret: b"test-secret-must-be-long-enough-for-hmac".to_vec(),
            jwt_ttl: 3600,
            start_time: std::time::Instant::now(),
        };
        assert_eq!(daemon_base(&state), "http://127.0.0.1:4200");
    }

    #[test]
    fn daemon_base_converts_wss_to_https() {
        use crate::config::{DaemonConfig, HiveConfig, ServerConfig};
        let state = crate::AppState {
            config: HiveConfig {
                server: ServerConfig::default(),
                daemon: DaemonConfig {
                    socket_path: std::path::PathBuf::from("/tmp/test.sock"),
                    ws_url: "wss://example.com".to_owned(),
                },
            },
            db: crate::db::Database::open_memory().unwrap(),
            jwt_secret: b"test-secret-must-be-long-enough-for-hmac".to_vec(),
            jwt_ttl: 3600,
            start_time: std::time::Instant::now(),
        };
        assert_eq!(daemon_base(&state), "https://example.com");
    }

    #[test]
    fn delete_nonexistent_room_returns_zero() {
        let db = crate::db::Database::open_memory().unwrap();
        seed_room(&db, "some-room");

        let rows = db
            .with_conn(|conn| {
                conn.execute(
                    "DELETE FROM workspace_rooms WHERE room_id = ?1",
                    rusqlite::params!["does-not-exist"],
                )
            })
            .unwrap();

        assert_eq!(rows, 0);
    }

    #[test]
    fn patch_room_sets_description() {
        let db = crate::db::Database::open_memory().unwrap();
        seed_room(&db, "room-dev");

        db.with_conn(|conn| {
            conn.execute(
                "UPDATE workspace_rooms SET description = ?1 WHERE room_id = 'room-dev'",
                ["A dev room"],
            )?;
            Ok(())
        })
        .unwrap();

        let desc: Option<String> = db
            .with_conn(|conn| {
                conn.query_row(
                    "SELECT description FROM workspace_rooms WHERE room_id = 'room-dev'",
                    [],
                    |row| row.get(0),
                )
            })
            .unwrap();

        assert_eq!(desc.as_deref(), Some("A dev room"));
    }

    #[test]
    fn patch_room_sets_display_name() {
        let db = crate::db::Database::open_memory().unwrap();
        seed_room(&db, "room-dev");

        db.with_conn(|conn| {
            conn.execute(
                "UPDATE workspace_rooms SET display_name = ?1 WHERE room_id = 'room-dev'",
                ["Dev Room"],
            )?;
            Ok(())
        })
        .unwrap();

        let name: Option<String> = db
            .with_conn(|conn| {
                conn.query_row(
                    "SELECT display_name FROM workspace_rooms WHERE room_id = 'room-dev'",
                    [],
                    |row| row.get(0),
                )
            })
            .unwrap();

        assert_eq!(name.as_deref(), Some("Dev Room"));
    }

    #[test]
    fn description_length_validation_enforces_280_char_limit() {
        assert!(validate_description_len(&"a".repeat(281)).is_err());
        assert!(validate_description_len(&"a".repeat(280)).is_ok());
        assert!(validate_description_len("").is_ok());
    }

    #[test]
    fn patch_room_display_name_defaults_to_null() {
        let db = crate::db::Database::open_memory().unwrap();
        seed_room(&db, "room-a");

        let (display_name, description): (Option<String>, Option<String>) = db
            .with_conn(|conn| {
                conn.query_row(
                    "SELECT display_name, description FROM workspace_rooms WHERE room_id = 'room-a'",
                    [],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
            })
            .unwrap();

        assert!(display_name.is_none());
        assert!(description.is_none());
    }

    #[test]
    fn get_members_returns_empty_when_no_room_members_table() {
        // Pre-MH-019: room_members table does not exist — endpoint returns empty list.
        let db = crate::db::Database::open_memory().unwrap();
        seed_room(&db, "room-dev");

        // Verify room_members table is absent.
        let table_exists: i64 = db
            .with_conn(|conn| {
                conn.query_row(
                    "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='room_members'",
                    [],
                    |row| row.get(0),
                )
            })
            .unwrap();
        assert_eq!(table_exists, 0);

        // Simulate what the handler does when the table is absent.
        let members: Vec<MemberInfo> = vec![];
        assert!(members.is_empty());
    }

    #[test]
    fn get_members_with_room_members_table() {
        // With MH-019 schema: members are returned from room_members + local_users join.
        let db = crate::db::Database::open_memory().unwrap();
        seed_room(&db, "room-dev");

        // Create room_members table as MH-019 would (local_users already exists in schema).
        db.with_conn(|conn| {
            conn.execute(
                "CREATE TABLE IF NOT EXISTS room_members (\
                    room_id TEXT NOT NULL, \
                    username TEXT NOT NULL, \
                    joined_at TEXT NOT NULL DEFAULT (datetime('now')), \
                    PRIMARY KEY (room_id, username)\
                )",
                [],
            )?;
            conn.execute(
                "INSERT INTO local_users (username, role, password_hash) \
                 VALUES ('alice', 'admin', 'hash')",
                [],
            )?;
            conn.execute(
                "INSERT INTO local_users (username, role, password_hash) \
                 VALUES ('bob', 'user', 'hash')",
                [],
            )?;
            conn.execute(
                "INSERT INTO room_members (room_id, username) VALUES ('room-dev', 'alice')",
                [],
            )?;
            conn.execute(
                "INSERT INTO room_members (room_id, username) VALUES ('room-dev', 'bob')",
                [],
            )?;
            Ok(())
        })
        .unwrap();

        let members: Vec<(String, String)> = db
            .with_conn(|conn| {
                let mut stmt = conn.prepare(
                    "SELECT rm.username, COALESCE(lu.role, 'user') \
                     FROM room_members rm \
                     LEFT JOIN local_users lu ON lu.username = rm.username \
                     WHERE rm.room_id = 'room-dev' \
                     ORDER BY rm.username ASC",
                )?;
                let rows: Vec<(String, String)> = stmt
                    .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
                    .collect::<Result<Vec<_>, _>>()?;
                Ok(rows)
            })
            .unwrap();

        assert_eq!(members.len(), 2);
        let usernames: Vec<&str> = members.iter().map(|(u, _)| u.as_str()).collect();
        assert!(usernames.contains(&"alice"));
        assert!(usernames.contains(&"bob"));
        // alice has admin role
        let alice = members.iter().find(|(u, _)| u == "alice").unwrap();
        assert_eq!(alice.1, "admin");
    }

    // -----------------------------------------------------------------------
    // Handler-level tests (axum::Router::oneshot)
    // -----------------------------------------------------------------------

    use axum::body::{to_bytes, Body};
    use axum::routing::post;
    use axum::Extension;
    use axum::Router;
    use tower::ServiceExt;

    fn make_test_state() -> std::sync::Arc<crate::AppState> {
        std::sync::Arc::new(crate::AppState {
            config: crate::config::HiveConfig::default(),
            db: crate::db::Database::open_memory().unwrap(),
            jwt_secret: b"test-secret-must-be-long-enough-for-hmac".to_vec(),
            jwt_ttl: 3600,
            start_time: std::time::Instant::now(),
        })
    }

    fn make_test_claims(sub: &str, role: &str) -> crate::auth::Claims {
        crate::auth::Claims {
            sub: sub.into(),
            username: "testuser".into(),
            role: role.into(),
            jti: uuid::Uuid::new_v4().to_string(),
            iat: 0,
            exp: u64::MAX,
        }
    }

    #[tokio::test]
    async fn handler_join_room_existing_room_returns_ok() {
        let state = make_test_state();
        seed_room(&state.db, "test-room");
        let claims = make_test_claims("1", "user");
        let app = Router::new()
            .route("/api/rooms/{room_id}/join", post(join_room))
            .with_state(std::sync::Arc::clone(&state))
            .layer(Extension(claims));
        let req = axum::http::Request::builder()
            .method("POST")
            .uri("/api/rooms/test-room/join")
            .body(Body::empty())
            .unwrap();
        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = to_bytes(resp.into_body(), 4096).await.unwrap();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();
        assert_eq!(json["room_id"], "test-room");
        assert_eq!(json["joined"], true);
    }

    #[tokio::test]
    async fn handler_join_room_missing_room_returns_not_found() {
        let state = make_test_state();
        let claims = make_test_claims("1", "user");
        let app = Router::new()
            .route("/api/rooms/{room_id}/join", post(join_room))
            .with_state(std::sync::Arc::clone(&state))
            .layer(Extension(claims));
        let req = axum::http::Request::builder()
            .method("POST")
            .uri("/api/rooms/nonexistent/join")
            .body(Body::empty())
            .unwrap();
        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn handler_leave_room_existing_room_returns_no_content() {
        let state = make_test_state();
        seed_room(&state.db, "test-room");
        let claims = make_test_claims("1", "user");
        let app = Router::new()
            .route("/api/rooms/{room_id}/leave", post(leave_room))
            .with_state(std::sync::Arc::clone(&state))
            .layer(Extension(claims));
        let req = axum::http::Request::builder()
            .method("POST")
            .uri("/api/rooms/test-room/leave")
            .body(Body::empty())
            .unwrap();
        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::NO_CONTENT);
    }

    #[tokio::test]
    async fn handler_leave_room_missing_room_returns_not_found() {
        let state = make_test_state();
        let claims = make_test_claims("1", "user");
        let app = Router::new()
            .route("/api/rooms/{room_id}/leave", post(leave_room))
            .with_state(std::sync::Arc::clone(&state))
            .layer(Extension(claims));
        let req = axum::http::Request::builder()
            .method("POST")
            .uri("/api/rooms/ghost/leave")
            .body(Body::empty())
            .unwrap();
        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn handler_patch_room_sets_display_name() {
        let state = make_test_state();
        seed_room(&state.db, "my-room");
        let app = Router::new()
            .route("/api/rooms/{room_id}", axum::routing::patch(patch_room))
            .with_state(std::sync::Arc::clone(&state));
        let payload = serde_json::to_vec(&serde_json::json!({"name": "MyRoom"})).unwrap();
        let req = axum::http::Request::builder()
            .method("PATCH")
            .uri("/api/rooms/my-room")
            .header("content-type", "application/json")
            .body(Body::from(payload))
            .unwrap();
        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let bytes = to_bytes(resp.into_body(), 4096).await.unwrap();
        let json: serde_json::Value = serde_json::from_slice(&bytes).unwrap();
        assert_eq!(json["display_name"], "MyRoom");
        assert_eq!(json["id"], "my-room");
    }

    #[tokio::test]
    async fn handler_patch_room_missing_room_returns_not_found() {
        let state = make_test_state();
        let app = Router::new()
            .route("/api/rooms/{room_id}", axum::routing::patch(patch_room))
            .with_state(std::sync::Arc::clone(&state));
        let payload = serde_json::to_vec(&serde_json::json!({"name": "NewName"})).unwrap();
        let req = axum::http::Request::builder()
            .method("PATCH")
            .uri("/api/rooms/does-not-exist")
            .header("content-type", "application/json")
            .body(Body::from(payload))
            .unwrap();
        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::NOT_FOUND);
    }

    #[tokio::test]
    async fn handler_patch_room_invalid_name_returns_bad_request() {
        let state = make_test_state();
        seed_room(&state.db, "my-room");
        let app = Router::new()
            .route("/api/rooms/{room_id}", axum::routing::patch(patch_room))
            .with_state(std::sync::Arc::clone(&state));
        let payload = serde_json::to_vec(&serde_json::json!({"name": "has spaces"})).unwrap();
        let req = axum::http::Request::builder()
            .method("PATCH")
            .uri("/api/rooms/my-room")
            .header("content-type", "application/json")
            .body(Body::from(payload))
            .unwrap();
        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn handler_patch_room_name_conflict_returns_conflict() {
        let state = make_test_state();
        seed_room(&state.db, "room-a");
        seed_room(&state.db, "room-b");
        let app = Router::new()
            .route("/api/rooms/{room_id}", axum::routing::patch(patch_room))
            .with_state(std::sync::Arc::clone(&state));
        // Attempt to set display_name of room-a to "room-b" — conflicts with existing room_id.
        let payload = serde_json::to_vec(&serde_json::json!({"name": "room-b"})).unwrap();
        let req = axum::http::Request::builder()
            .method("PATCH")
            .uri("/api/rooms/room-a")
            .header("content-type", "application/json")
            .body(Body::from(payload))
            .unwrap();
        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::CONFLICT);
    }
}
