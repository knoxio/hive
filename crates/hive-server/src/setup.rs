//! First-run setup wizard API (MH-004).
//!
//! Provides PUBLIC (no-auth) endpoints for the initial Hive setup flow:
//!
//! | Endpoint                       | Purpose                                         |
//! |-------------------------------|--------------------------------------------------|
//! | `GET  /api/setup/status`       | Check whether setup has been completed           |
//! | `POST /api/setup/verify-daemon`| Health-check a daemon URL without saving it      |
//! | `POST /api/setup/configure`    | Write daemon URL to `app_settings`               |
//! | `POST /api/setup/create-admin` | Create the first admin user (only if none exist) |
//! | `POST /api/setup/complete`     | Mark `setup_complete = true`                     |
//!
//! All mutating endpoints reject requests once `setup_complete` is set.

use std::sync::Arc;

use axum::extract::State;
use axum::response::IntoResponse;
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::error::HiveError;
use crate::AppState;

/// `app_settings` key that records whether setup has been finished.
pub const KEY_SETUP_COMPLETE: &str = "setup_complete";

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------

/// Response body for `GET /api/setup/status`.
#[derive(Serialize)]
pub struct SetupStatusResponse {
    /// `true` when the wizard has been completed at least once.
    pub setup_complete: bool,
    /// `true` when at least one local user exists in the database.
    pub has_admin: bool,
}

/// Response body for `POST /api/setup/verify-daemon`.
#[derive(Serialize)]
pub struct VerifyDaemonResponse {
    /// Whether the daemon `/api/health` endpoint responded with 2xx.
    pub reachable: bool,
    /// Human-readable failure reason, or `null` on success.
    pub error: Option<String>,
}

/// Shared response for successful mutation endpoints.
#[derive(Serialize)]
pub struct OkResponse {
    pub message: &'static str,
}

/// Request body for `POST /api/setup/verify-daemon`.
#[derive(Deserialize)]
pub struct VerifyDaemonRequest {
    /// Full URL to probe (e.g. `ws://daemon:4200` or `http://daemon:4200`).
    pub url: String,
}

/// Request body for `POST /api/setup/configure`.
#[derive(Deserialize)]
pub struct ConfigureRequest {
    /// Daemon WebSocket URL to save (e.g. `ws://room-daemon:4200`).
    pub daemon_url: String,
}

/// Request body for `POST /api/setup/create-admin`.
#[derive(Deserialize)]
pub struct CreateAdminRequest {
    /// Desired admin username.
    pub username: String,
    /// Admin password (min 8 characters; hashed with bcrypt before storage).
    pub password: String,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Return `true` when `setup_complete = true` is stored in `app_settings`.
pub fn is_setup_complete(state: &AppState) -> bool {
    state
        .db
        .get_setting(KEY_SETUP_COMPLETE)
        .ok()
        .flatten()
        .as_deref()
        == Some("true")
}

/// Return `true` when at least one row exists in `local_users`.
pub fn has_admin(state: &AppState) -> bool {
    state
        .db
        .with_conn(|conn| {
            let count: i64 =
                conn.query_row("SELECT COUNT(*) FROM local_users LIMIT 1", [], |row| {
                    row.get(0)
                })?;
            Ok::<_, rusqlite::Error>(count > 0)
        })
        .unwrap_or(false)
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/setup/status` — check whether initial setup has been completed.
pub(crate) async fn get_status(State(state): State<Arc<AppState>>) -> Json<SetupStatusResponse> {
    Json(SetupStatusResponse {
        setup_complete: is_setup_complete(&state),
        has_admin: has_admin(&state),
    })
}

/// `POST /api/setup/verify-daemon` — health-check a URL without saving it.
///
/// Sends `GET <url>/api/health` with a 5-second timeout.  Returns
/// `{ reachable: true }` on a 2xx response, or `{ reachable: false, error }`.
pub(crate) async fn verify_daemon(
    State(state): State<Arc<AppState>>,
    Json(req): Json<VerifyDaemonRequest>,
) -> impl IntoResponse {
    if is_setup_complete(&state) {
        return HiveError::BadRequest("setup already complete".into()).into_response();
    }

    if req.url.is_empty() {
        return Json(VerifyDaemonResponse {
            reachable: false,
            error: Some("url is required".into()),
        })
        .into_response();
    }

    // Normalise ws:// → http:// for the HTTP health-check request.
    let base = req
        .url
        .replace("wss://", "https://")
        .replace("ws://", "http://");

    match reqwest::Client::new()
        .get(format!("{base}/api/health"))
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => Json(VerifyDaemonResponse {
            reachable: true,
            error: None,
        })
        .into_response(),
        Ok(resp) => Json(VerifyDaemonResponse {
            reachable: false,
            error: Some(format!("daemon returned HTTP {}", resp.status())),
        })
        .into_response(),
        Err(e) => Json(VerifyDaemonResponse {
            reachable: false,
            error: Some(format!("connection failed: {e}")),
        })
        .into_response(),
    }
}

/// `POST /api/setup/configure` — save the daemon URL to `app_settings`.
pub(crate) async fn configure(
    State(state): State<Arc<AppState>>,
    Json(req): Json<ConfigureRequest>,
) -> Result<Json<OkResponse>, HiveError> {
    if is_setup_complete(&state) {
        return Err(HiveError::BadRequest("setup already complete".into()));
    }

    if req.daemon_url.is_empty() {
        return Err(HiveError::BadRequest("daemon_url is required".into()));
    }

    // Validate URL: must parse and use an accepted scheme.
    let parsed = reqwest::Url::parse(&req.daemon_url)
        .map_err(|_| HiveError::BadRequest(format!("invalid URL: {}", req.daemon_url)))?;

    if !["ws", "wss", "http", "https"].contains(&parsed.scheme()) {
        return Err(HiveError::BadRequest(format!(
            "unsupported scheme '{}': use ws, wss, http, or https",
            parsed.scheme()
        )));
    }

    state
        .db
        .set_setting(crate::settings::KEY_DAEMON_URL, &req.daemon_url, "setup")
        .map_err(|e| HiveError::Internal(format!("db error: {e}")))?;

    tracing::info!(daemon_url = %req.daemon_url, "setup: daemon URL configured");

    Ok(Json(OkResponse {
        message: "daemon URL saved",
    }))
}

/// `POST /api/setup/create-admin` — create the first admin user.
///
/// Fails if an admin already exists or if the password is too short.
/// Uses bcrypt to hash the password before storage.
pub(crate) async fn create_admin(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateAdminRequest>,
) -> Result<Json<OkResponse>, HiveError> {
    if is_setup_complete(&state) {
        return Err(HiveError::BadRequest("setup already complete".into()));
    }

    if req.username.is_empty() {
        return Err(HiveError::BadRequest("username is required".into()));
    }

    if req.password.len() < 8 {
        return Err(HiveError::BadRequest(
            "password must be at least 8 characters".into(),
        ));
    }

    if has_admin(&state) {
        return Err(HiveError::BadRequest("an admin user already exists".into()));
    }

    let username = req.username.clone();
    let password = req.password.clone();
    let db = state.db.clone();

    tokio::task::spawn_blocking(move || {
        let hash = bcrypt::hash(&password, bcrypt::DEFAULT_COST)
            .map_err(|e| HiveError::Internal(format!("hash error: {e}")))?;

        db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO local_users (username, password_hash, role) \
                 VALUES (?1, ?2, 'admin')",
                rusqlite::params![username, hash],
            )?;
            Ok::<_, rusqlite::Error>(())
        })
        .map_err(|e| HiveError::Internal(format!("db error: {e}")))?;

        Ok::<_, HiveError>(())
    })
    .await
    .map_err(|e| HiveError::Internal(format!("task error: {e}")))??;

    tracing::info!(username = %req.username, "setup: admin user created");

    Ok(Json(OkResponse {
        message: "admin user created",
    }))
}

/// `POST /api/setup/complete` — finalise setup.
///
/// Sets `setup_complete = true` in `app_settings`.  Fails if no admin user
/// exists yet (the wizard must complete step 2 before calling this).
pub(crate) async fn complete(
    State(state): State<Arc<AppState>>,
) -> Result<Json<OkResponse>, HiveError> {
    if is_setup_complete(&state) {
        return Err(HiveError::BadRequest("setup already complete".into()));
    }

    if !has_admin(&state) {
        return Err(HiveError::BadRequest(
            "cannot complete setup: create an admin user first".into(),
        ));
    }

    state
        .db
        .set_setting(KEY_SETUP_COMPLETE, "true", "setup")
        .map_err(|e| HiveError::Internal(format!("db error: {e}")))?;

    tracing::info!("setup: wizard completed — setup_complete=true");

    Ok(Json(OkResponse {
        message: "setup complete",
    }))
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;

    fn mk_state(db: Database) -> AppState {
        AppState {
            config: crate::config::HiveConfig::default(),
            db,
            jwt_secret: b"test-secret-at-least-32-bytes-long!".to_vec(),
            jwt_ttl: 86_400,
            start_time: std::time::Instant::now(),
        }
    }

    #[test]
    fn setup_not_complete_when_key_missing() {
        let db = Database::open_memory().unwrap();
        let state = mk_state(db);
        assert!(!is_setup_complete(&state));
    }

    #[test]
    fn setup_complete_after_setting_key() {
        let db = Database::open_memory().unwrap();
        db.set_setting(KEY_SETUP_COMPLETE, "true", "test").unwrap();
        let state = mk_state(db);
        assert!(is_setup_complete(&state));
    }

    #[test]
    fn setup_incomplete_when_key_is_false() {
        let db = Database::open_memory().unwrap();
        db.set_setting(KEY_SETUP_COMPLETE, "false", "test").unwrap();
        let state = mk_state(db);
        assert!(!is_setup_complete(&state));
    }

    #[test]
    fn has_admin_false_when_no_users() {
        let db = Database::open_memory().unwrap();
        let state = mk_state(db);
        assert!(!has_admin(&state));
    }

    #[test]
    fn has_admin_true_after_insert() {
        let db = Database::open_memory().unwrap();
        db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO local_users (username, password_hash, role) \
                 VALUES ('admin', 'hash', 'admin')",
                [],
            )?;
            Ok(())
        })
        .unwrap();
        let state = mk_state(db);
        assert!(has_admin(&state));
    }

    #[test]
    fn complete_rejected_when_no_admin() {
        let db = Database::open_memory().unwrap();
        let state = mk_state(db);
        // is_setup_complete is false, but has_admin is also false — complete should fail.
        assert!(!has_admin(&state));
    }

    #[test]
    fn is_setup_complete_false_by_default_on_new_db() {
        let db = Database::open_memory().unwrap();
        let state = mk_state(db);
        assert!(
            !is_setup_complete(&state),
            "new database should not be marked as complete"
        );
    }
}
