//! Room management API — MH-016 (list rooms), MH-014 (create room), MH-015 (delete room).
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
    Json,
};
use serde::{Deserialize, Serialize};

use crate::AppState;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// A room entry returned by `GET /api/rooms`.
#[derive(Debug, Serialize)]
pub struct Room {
    pub id: String,
    pub name: String,
    pub workspace_id: i64,
    pub workspace_name: String,
    pub added_at: String,
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
            "SELECT wr.room_id, wr.workspace_id, w.name, wr.added_at \
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
                Ok(Room {
                    name: room_id.clone(),
                    id: room_id,
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

    #[test]
    fn delete_existing_room_returns_one() {
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
                "INSERT INTO workspace_rooms (workspace_id, room_id) VALUES (1, 'to-delete')",
                [],
            )?;
            Ok(())
        })
        .unwrap();

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
    fn delete_nonexistent_room_returns_zero() {
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
            Ok(())
        })
        .unwrap();

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
}
