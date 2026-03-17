//! Admin user management API (MH-012).
//!
//! All routes require a valid Bearer JWT **and** `role = "admin"`.
//! Non-admin requests are rejected with HTTP 403.
//!
//! Routes (all under `/api/admin/users`):
//! - `GET  /api/admin/users`          — list users (paginated)
//! - `POST /api/admin/users`          — create a new user
//! - `PATCH /api/admin/users/:id`     — update role or active status
//! - `DELETE /api/admin/users/:id`    — hard-delete a user (with last-admin guard)

use axum::extract::{Path, Query, State};
use axum::Json;
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::auth::Claims;
use crate::error::{HiveError, HiveResult};
use crate::AppState;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// A user record returned by the admin list / create endpoints.
#[derive(Debug, Serialize)]
pub struct AdminUser {
    pub id: i64,
    pub username: String,
    pub role: String,
    pub active: bool,
    pub created_at: String,
}

/// Query parameters for `GET /api/admin/users`.
#[derive(Debug, Deserialize)]
pub struct ListUsersQuery {
    /// Page number (1-based). Defaults to 1.
    #[serde(default = "default_page")]
    pub page: u32,
    /// Page size. Defaults to 50, capped at 200.
    #[serde(default = "default_page_size")]
    pub page_size: u32,
}

fn default_page() -> u32 {
    1
}
fn default_page_size() -> u32 {
    50
}

/// Response for `GET /api/admin/users`.
#[derive(Serialize)]
pub struct ListUsersResponse {
    pub users: Vec<AdminUser>,
    pub total: i64,
    pub page: u32,
    pub page_size: u32,
}

/// Request body for `POST /api/admin/users`.
#[derive(Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub password: String,
    /// Role to assign. Defaults to "user" if omitted.
    #[serde(default = "default_role")]
    pub role: String,
}

fn default_role() -> String {
    "user".to_string()
}

/// Request body for `PATCH /api/admin/users/:id`.
#[derive(Deserialize)]
pub struct PatchUserRequest {
    /// New role. Must be one of "admin", "user".
    pub role: Option<String>,
    /// Active status.
    pub active: Option<bool>,
}

/// Response for `POST /api/admin/users`.
#[derive(Serialize)]
pub struct CreateUserResponse {
    pub id: i64,
    pub username: String,
    pub role: String,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Verify the caller has role = "admin". Returns 403 otherwise.
fn require_admin(claims: &Claims) -> HiveResult<()> {
    if claims.role != "admin" {
        return Err(HiveError::Forbidden("admin role required".into()));
    }
    Ok(())
}

/// Validate that a role string is one of the accepted values.
fn validate_role(role: &str) -> HiveResult<()> {
    match role {
        "admin" | "user" => Ok(()),
        _ => Err(HiveError::BadRequest(format!(
            "invalid role '{role}'; must be 'admin' or 'user'"
        ))),
    }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/admin/users` — list all users, paginated.
pub(crate) async fn list_users(
    State(state): State<Arc<AppState>>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Query(params): Query<ListUsersQuery>,
) -> HiveResult<Json<ListUsersResponse>> {
    require_admin(&claims)?;

    let page = params.page.max(1);
    let page_size = params.page_size.clamp(1, 200);
    let offset = (page - 1) * page_size;

    let db = state.db.clone();
    tokio::task::spawn_blocking(move || {
        db.with_conn(|conn| {
            let total: i64 =
                conn.query_row("SELECT COUNT(*) FROM local_users", [], |row| row.get(0))?;

            let mut stmt = conn.prepare(
                "SELECT id, username, role, active, created_at \
                 FROM local_users \
                 ORDER BY id \
                 LIMIT ?1 OFFSET ?2",
            )?;

            let users: Vec<AdminUser> = stmt
                .query_map([page_size as i64, offset as i64], |row| {
                    Ok(AdminUser {
                        id: row.get(0)?,
                        username: row.get(1)?,
                        role: row.get(2)?,
                        active: row.get::<_, i64>(3)? != 0,
                        created_at: row.get(4)?,
                    })
                })?
                .collect::<Result<Vec<_>, _>>()?;

            Ok(ListUsersResponse {
                users,
                total,
                page,
                page_size,
            })
        })
    })
    .await
    .map_err(|e| HiveError::Internal(format!("task join error: {e}")))?
    .map_err(|e| HiveError::Internal(format!("db error: {e}")))
    .map(Json)
}

/// `POST /api/admin/users` — create a new local user.
pub(crate) async fn create_user(
    State(state): State<Arc<AppState>>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Json(req): Json<CreateUserRequest>,
) -> HiveResult<Json<CreateUserResponse>> {
    require_admin(&claims)?;

    if req.username.is_empty() || req.password.is_empty() {
        return Err(HiveError::BadRequest(
            "username and password are required".into(),
        ));
    }
    validate_role(&req.role)?;

    let password = req.password.clone();
    let hash = tokio::task::spawn_blocking(move || bcrypt::hash(&password, bcrypt::DEFAULT_COST))
        .await
        .map_err(|e| HiveError::Internal(format!("task join error: {e}")))?
        .map_err(|e| HiveError::Internal(format!("bcrypt error: {e}")))?;

    let db = state.db.clone();
    let username = req.username.clone();
    let role = req.role.clone();
    tokio::task::spawn_blocking(move || {
        db.with_conn(|conn| {
            let result = conn.execute(
                "INSERT INTO local_users (username, password_hash, role) VALUES (?1, ?2, ?3)",
                rusqlite::params![username, hash, role],
            );
            match result {
                Err(rusqlite::Error::SqliteFailure(e, _))
                    if e.code == rusqlite::ErrorCode::ConstraintViolation =>
                {
                    return Err(rusqlite::Error::SqliteFailure(
                        e,
                        Some("username already exists".to_string()),
                    ))
                }
                Err(e) => return Err(e),
                Ok(_) => {}
            }
            let id: i64 = conn.query_row("SELECT last_insert_rowid()", [], |row| row.get(0))?;
            Ok(CreateUserResponse {
                id,
                username: req.username,
                role: req.role,
            })
        })
    })
    .await
    .map_err(|e| HiveError::Internal(format!("task join error: {e}")))?
    .map_err(|e| {
        if e.to_string().contains("username already exists")
            || e.to_string().contains("UNIQUE constraint")
        {
            HiveError::Conflict("username already exists".into())
        } else {
            HiveError::Internal(format!("db error: {e}"))
        }
    })
    .map(Json)
}

/// `PATCH /api/admin/users/:id` — update role or active status.
///
/// Guards against removing the last admin: if the caller tries to change their
/// own role away from "admin" and no other admin exists, this returns 409.
pub(crate) async fn patch_user(
    State(state): State<Arc<AppState>>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Path(user_id): Path<i64>,
    Json(req): Json<PatchUserRequest>,
) -> HiveResult<Json<AdminUser>> {
    require_admin(&claims)?;

    if let Some(ref role) = req.role {
        validate_role(role)?;
    }

    let db = state.db.clone();
    let caller_sub = claims.sub.clone();
    tokio::task::spawn_blocking(move || {
        db.with_conn(|conn| {
            // Verify target user exists.
            let existing: Option<(String, i64)> = conn
                .query_row(
                    "SELECT role, active FROM local_users WHERE id = ?1",
                    [user_id],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .ok();
            let (current_role, current_active) =
                existing.ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)?;

            let new_role = req.role.as_deref().unwrap_or(&current_role);
            let new_active = req.active.map(|b| b as i64).unwrap_or(current_active);

            // Last-admin guard: if changing this user's role away from admin,
            // make sure at least one other admin remains.
            if current_role == "admin" && new_role != "admin" {
                let admin_count: i64 = conn.query_row(
                    "SELECT COUNT(*) FROM local_users WHERE role = 'admin' AND active = 1",
                    [],
                    |row| row.get(0),
                )?;
                if admin_count <= 1 {
                    // Use a unique error string we can detect below.
                    return Err(rusqlite::Error::SqliteFailure(
                        rusqlite::ffi::Error {
                            code: rusqlite::ErrorCode::ConstraintViolation,
                            extended_code: 0,
                        },
                        Some("LAST_ADMIN".to_string()),
                    ));
                }
            }

            conn.execute(
                "UPDATE local_users SET role = ?1, active = ?2 WHERE id = ?3",
                rusqlite::params![new_role, new_active, user_id],
            )?;

            let user = conn.query_row(
                "SELECT id, username, role, active, created_at FROM local_users WHERE id = ?1",
                [user_id],
                |row| {
                    Ok(AdminUser {
                        id: row.get(0)?,
                        username: row.get(1)?,
                        role: row.get(2)?,
                        active: row.get::<_, i64>(3)? != 0,
                        created_at: row.get(4)?,
                    })
                },
            )?;

            let _ = caller_sub; // suppress unused warning
            Ok(user)
        })
    })
    .await
    .map_err(|e| HiveError::Internal(format!("task join error: {e}")))?
    .map_err(|e| {
        let s = e.to_string();
        if s.contains("LAST_ADMIN") {
            HiveError::Conflict("cannot remove admin role: this is the last active admin".into())
        } else if matches!(e, rusqlite::Error::QueryReturnedNoRows) {
            HiveError::NotFound(format!("user {user_id} not found"))
        } else {
            HiveError::Internal(format!("db error: {e}"))
        }
    })
    .map(Json)
}

/// `DELETE /api/admin/users/:id` — hard-delete a user.
///
/// Requires the caller to be admin. The caller cannot delete themselves.
/// The last active admin cannot be deleted.
pub(crate) async fn delete_user(
    State(state): State<Arc<AppState>>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
    Path(user_id): Path<i64>,
) -> HiveResult<axum::http::StatusCode> {
    require_admin(&claims)?;

    // Prevent self-deletion.
    if claims.sub == user_id.to_string() {
        return Err(HiveError::Conflict("cannot delete your own account".into()));
    }

    let db = state.db.clone();
    tokio::task::spawn_blocking(move || {
        db.with_conn(|conn| {
            // Check user exists and get their role.
            let (role, _active): (String, i64) = conn
                .query_row(
                    "SELECT role, active FROM local_users WHERE id = ?1",
                    [user_id],
                    |row| Ok((row.get(0)?, row.get(1)?)),
                )
                .map_err(|_| rusqlite::Error::QueryReturnedNoRows)?;

            // Last-admin guard.
            if role == "admin" {
                let admin_count: i64 = conn.query_row(
                    "SELECT COUNT(*) FROM local_users WHERE role = 'admin' AND active = 1",
                    [],
                    |row| row.get(0),
                )?;
                if admin_count <= 1 {
                    return Err(rusqlite::Error::SqliteFailure(
                        rusqlite::ffi::Error {
                            code: rusqlite::ErrorCode::ConstraintViolation,
                            extended_code: 0,
                        },
                        Some("LAST_ADMIN".to_string()),
                    ));
                }
            }

            conn.execute("DELETE FROM local_users WHERE id = ?1", [user_id])?;
            Ok(())
        })
    })
    .await
    .map_err(|e| HiveError::Internal(format!("task join error: {e}")))?
    .map_err(|e| {
        let s = e.to_string();
        if s.contains("LAST_ADMIN") {
            HiveError::Conflict("cannot delete the last active admin".into())
        } else if matches!(e, rusqlite::Error::QueryReturnedNoRows) {
            HiveError::NotFound(format!("user {user_id} not found"))
        } else {
            HiveError::Internal(format!("db error: {e}"))
        }
    })?;

    Ok(axum::http::StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;

    fn seed_admin(db: &Database) -> i64 {
        let hash = bcrypt::hash("admin-pass", 4).unwrap();
        db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO local_users (username, password_hash, role) VALUES ('admin', ?1, 'admin')",
                [&hash],
            )?;
            Ok(conn.last_insert_rowid())
        })
        .unwrap()
    }

    fn seed_user(db: &Database, username: &str) -> i64 {
        let hash = bcrypt::hash("pass", 4).unwrap();
        db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO local_users (username, password_hash, role) VALUES (?1, ?2, 'user')",
                rusqlite::params![username, hash],
            )?;
            Ok(conn.last_insert_rowid())
        })
        .unwrap()
    }

    #[test]
    fn require_admin_passes_for_admin_role() {
        let claims = Claims {
            sub: "1".into(),
            username: "admin".into(),
            role: "admin".into(),
            jti: "jti".into(),
            iat: 0,
            exp: u64::MAX,
        };
        assert!(require_admin(&claims).is_ok());
    }

    #[test]
    fn require_admin_fails_for_user_role() {
        let claims = Claims {
            sub: "2".into(),
            username: "user".into(),
            role: "user".into(),
            jti: "jti".into(),
            iat: 0,
            exp: u64::MAX,
        };
        let err = require_admin(&claims).unwrap_err();
        assert!(matches!(err, HiveError::Forbidden(_)));
    }

    #[test]
    fn validate_role_accepts_valid_roles() {
        assert!(validate_role("admin").is_ok());
        assert!(validate_role("user").is_ok());
    }

    #[test]
    fn validate_role_rejects_invalid_role() {
        let err = validate_role("superuser").unwrap_err();
        assert!(matches!(err, HiveError::BadRequest(_)));
    }

    #[test]
    fn list_users_db_query_returns_all_users() {
        let db = Database::open_memory().unwrap();
        seed_admin(&db);
        seed_user(&db, "alice");
        seed_user(&db, "bob");

        let result = db
            .with_conn(|conn| {
                let total: i64 =
                    conn.query_row("SELECT COUNT(*) FROM local_users", [], |row| row.get(0))?;
                Ok(total)
            })
            .unwrap();

        assert_eq!(result, 3);
    }

    #[test]
    fn active_column_defaults_to_one() {
        let db = Database::open_memory().unwrap();
        let id = seed_user(&db, "newuser");

        db.with_conn(|conn| {
            let active: i64 = conn.query_row(
                "SELECT active FROM local_users WHERE id = ?1",
                [id],
                |row| row.get(0),
            )?;
            assert_eq!(active, 1);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn deactivate_user_sets_active_to_zero() {
        let db = Database::open_memory().unwrap();
        let id = seed_user(&db, "victim");

        db.with_conn(|conn| {
            conn.execute("UPDATE local_users SET active = 0 WHERE id = ?1", [id])?;
            let active: i64 = conn.query_row(
                "SELECT active FROM local_users WHERE id = ?1",
                [id],
                |row| row.get(0),
            )?;
            assert_eq!(active, 0);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn last_admin_guard_prevents_role_downgrade() {
        let db = Database::open_memory().unwrap();
        let admin_id = seed_admin(&db);

        // There is only one admin. Trying to set role to 'user' must fail.
        let result = db.with_conn(|conn| {
            let admin_count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM local_users WHERE role = 'admin' AND active = 1",
                [],
                |row| row.get(0),
            )?;
            if admin_count <= 1 {
                return Err(rusqlite::Error::SqliteFailure(
                    rusqlite::ffi::Error {
                        code: rusqlite::ErrorCode::ConstraintViolation,
                        extended_code: 0,
                    },
                    Some("LAST_ADMIN".to_string()),
                ));
            }
            conn.execute(
                "UPDATE local_users SET role = 'user' WHERE id = ?1",
                [admin_id],
            )?;
            Ok(())
        });
        assert!(result.is_err());
        let s = result.unwrap_err().to_string();
        assert!(
            s.contains("LAST_ADMIN"),
            "expected LAST_ADMIN guard, got: {s}"
        );
    }

    #[test]
    fn delete_non_last_admin_succeeds() {
        let db = Database::open_memory().unwrap();
        seed_admin(&db);
        // Add second admin
        let hash = bcrypt::hash("pass2", 4).unwrap();
        let id2 = db
            .with_conn(|conn| {
                conn.execute(
                    "INSERT INTO local_users (username, password_hash, role) VALUES ('admin2', ?1, 'admin')",
                    [&hash],
                )?;
                Ok(conn.last_insert_rowid())
            })
            .unwrap();

        db.with_conn(|conn| {
            conn.execute("DELETE FROM local_users WHERE id = ?1", [id2])?;
            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM local_users WHERE id = ?1",
                [id2],
                |row| row.get(0),
            )?;
            assert_eq!(count, 0);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn username_uniqueness_enforced() {
        let db = Database::open_memory().unwrap();
        seed_user(&db, "dupeuser");
        let result = db.with_conn(|conn| {
            let hash = bcrypt::hash("pass", 4).unwrap();
            conn.execute(
                "INSERT INTO local_users (username, password_hash, role) VALUES ('dupeuser', ?1, 'user')",
                [&hash],
            )
        });
        assert!(result.is_err());
    }
}
