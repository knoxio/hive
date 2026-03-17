//! App settings API — runtime configuration stored in the database.
//!
//! Exposes `GET /api/settings`, `PATCH /api/settings`, and
//! `GET /api/settings/history` to read, update, and audit key/value settings.
//! The `daemon_url` setting controls which room daemon all proxy calls target.
//!
//! On first run, seeds defaults from environment variables (see [`seed_defaults`]).
//!
//! Every `PATCH` call is audited in `app_settings_history`. The `daemon_url`
//! key is validated for URL scheme before writing — MH-029.

use std::collections::HashMap;
use std::sync::Arc;

use axum::extract::{Query, State};
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::db::SettingHistoryRow;
use crate::AppState;

/// Known setting keys.
pub const KEY_DAEMON_URL: &str = "daemon_url";

/// Valid URL schemes for the daemon URL setting.
const VALID_DAEMON_URL_SCHEMES: &[&str] = &["ws", "wss", "http", "https"];

// ---------------------------------------------------------------------------
// URL validation
// ---------------------------------------------------------------------------

/// Validate a daemon URL: must parse as a URL and use an accepted scheme.
fn validate_daemon_url(raw: &str) -> Result<(), String> {
    let parsed = reqwest::Url::parse(raw).map_err(|_| format!("invalid URL: {raw}"))?;

    if !VALID_DAEMON_URL_SCHEMES.contains(&parsed.scheme()) {
        return Err(format!(
            "invalid scheme '{}': must be one of ws, wss, http, https",
            parsed.scheme()
        ));
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /api/settings — returns all settings as a JSON object.
pub async fn get_settings(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let result = state.db.with_conn(|conn| {
        let mut stmt = conn.prepare("SELECT key, value FROM app_settings ORDER BY key")?;
        let pairs = stmt
            .query_map([], |row| {
                let k: String = row.get(0)?;
                let v: String = row.get(1)?;
                Ok((k, v))
            })?
            .collect::<Result<HashMap<String, String>, _>>()?;
        Ok(pairs)
    });

    match result {
        Ok(settings) => (StatusCode::OK, Json(settings)).into_response(),
        Err(e) => {
            tracing::error!("failed to read settings: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, "internal error").into_response()
        }
    }
}

/// Request body for PATCH /api/settings.
#[derive(Debug, Deserialize)]
pub struct PatchSettingsRequest(HashMap<String, String>);

/// PATCH /api/settings — updates one or more settings.
///
/// Unknown keys are accepted (open key/value store). An empty patch body
/// returns 400 — use explicit keys.
///
/// The `daemon_url` key is validated for URL scheme. Every write is audited in
/// `app_settings_history`. The `changed_by` field is `"system"` until
/// MH-013 (auth) is wired in.
pub async fn patch_settings(
    State(state): State<Arc<AppState>>,
    Json(PatchSettingsRequest(updates)): Json<PatchSettingsRequest>,
) -> impl IntoResponse {
    if updates.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({"error": "no fields provided"})),
        )
            .into_response();
    }

    // Validate before writing anything.
    if let Some(url) = updates.get(KEY_DAEMON_URL) {
        if let Err(msg) = validate_daemon_url(url) {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({"error": msg})),
            )
                .into_response();
        }
    }

    // Write all keys with audit logging.
    for (key, value) in &updates {
        if let Err(e) = state.db.set_setting(key, value, "system") {
            tracing::error!("failed to update setting '{key}': {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "internal error"})),
            )
                .into_response();
        }
        if key == KEY_DAEMON_URL {
            tracing::info!(daemon_url = %value, "settings_changed: daemon_url updated");
        }
    }

    // Return updated settings.
    let settings_result = state.db.with_conn(|conn| {
        let mut stmt = conn.prepare("SELECT key, value FROM app_settings ORDER BY key")?;
        let pairs = stmt
            .query_map([], |row| {
                let k: String = row.get(0)?;
                let v: String = row.get(1)?;
                Ok((k, v))
            })?
            .collect::<Result<HashMap<String, String>, _>>()?;
        Ok(pairs)
    });

    match settings_result {
        Ok(settings) => (StatusCode::OK, Json(settings)).into_response(),
        Err(e) => {
            tracing::error!("failed to read settings after patch: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, "internal error").into_response()
        }
    }
}

/// Query parameters for `GET /api/settings/history`.
#[derive(Debug, Deserialize)]
pub struct HistoryQuery {
    pub key: Option<String>,
    pub limit: Option<i64>,
}

/// A single entry in the settings change log.
#[derive(Debug, Serialize)]
pub struct SettingHistoryItem {
    pub id: i64,
    pub key: String,
    pub old_value: Option<String>,
    pub new_value: String,
    pub changed_by: String,
    pub changed_at: String,
}

impl From<SettingHistoryRow> for SettingHistoryItem {
    fn from(r: SettingHistoryRow) -> Self {
        Self {
            id: r.id,
            key: r.key,
            old_value: r.old_value,
            new_value: r.new_value,
            changed_by: r.changed_by,
            changed_at: r.changed_at,
        }
    }
}

/// GET /api/settings/history — return the change log for a settings key.
///
/// Query params:
/// - `key` (default: `daemon_url`)
/// - `limit` (default: 5, max: 100)
pub async fn get_settings_history(
    State(state): State<Arc<AppState>>,
    Query(params): Query<HistoryQuery>,
) -> impl IntoResponse {
    let key = params.key.unwrap_or_else(|| KEY_DAEMON_URL.to_owned());
    let limit = params.limit.unwrap_or(5).clamp(1, 100);

    let db = state.db.clone();
    match tokio::task::spawn_blocking(move || db.get_setting_history(&key, limit)).await {
        Ok(Ok(rows)) => {
            let items: Vec<SettingHistoryItem> = rows.into_iter().map(Into::into).collect();
            (StatusCode::OK, Json(items)).into_response()
        }
        Ok(Err(e)) => {
            tracing::error!("failed to read settings history: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, "internal error").into_response()
        }
        Err(e) => {
            tracing::error!("spawn_blocking panicked: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, "internal error").into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// Seed helpers
// ---------------------------------------------------------------------------

/// Seed default settings on first run.
///
/// `daemon_url` is the resolved daemon URL — callers should resolve env
/// overrides before calling (see [`resolve_daemon_url`]). If a key already
/// exists in the DB it is not overwritten.
pub fn seed_defaults(db: &crate::db::Database, daemon_url: &str) {
    let result = db.with_conn(|conn| {
        conn.execute(
            "INSERT OR IGNORE INTO app_settings (key, value) VALUES (?1, ?2)",
            rusqlite::params![KEY_DAEMON_URL, daemon_url],
        )?;
        Ok(())
    });

    if let Err(e) = result {
        tracing::warn!("failed to seed default settings: {e}");
    }
}

/// Resolve the daemon URL, preferring `HIVE_DAEMON_URL` over the config value.
pub fn resolve_daemon_url(config_ws_url: &str) -> String {
    std::env::var("HIVE_DAEMON_URL").unwrap_or_else(|_| config_ws_url.to_owned())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;

    fn test_db() -> Database {
        Database::open_memory().expect("in-memory db")
    }

    #[test]
    fn settings_table_exists_after_migration() {
        let db = test_db();
        db.with_conn(|conn| {
            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='app_settings'",
                [],
                |row| row.get(0),
            )?;
            assert_eq!(count, 1);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn seed_defaults_inserts_daemon_url() {
        let db = test_db();
        seed_defaults(&db, "ws://127.0.0.1:4200");

        db.with_conn(|conn| {
            let val: String = conn.query_row(
                "SELECT value FROM app_settings WHERE key = 'daemon_url'",
                [],
                |row| row.get(0),
            )?;
            assert_eq!(val, "ws://127.0.0.1:4200");
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn seed_defaults_does_not_overwrite_existing() {
        let db = test_db();
        db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO app_settings (key, value) VALUES ('daemon_url', 'ws://existing:5000')",
                [],
            )?;
            Ok(())
        })
        .unwrap();

        seed_defaults(&db, "ws://127.0.0.1:4200");

        db.with_conn(|conn| {
            let val: String = conn.query_row(
                "SELECT value FROM app_settings WHERE key = 'daemon_url'",
                [],
                |row| row.get(0),
            )?;
            assert_eq!(val, "ws://existing:5000");
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn write_and_read_setting() {
        let db = test_db();
        db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO app_settings (key, value) VALUES ('test_key', 'hello')",
                [],
            )?;
            let val: String = conn.query_row(
                "SELECT value FROM app_settings WHERE key = 'test_key'",
                [],
                |row| row.get(0),
            )?;
            assert_eq!(val, "hello");
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn upsert_setting_updates_value() {
        let db = test_db();
        db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO app_settings (key, value) VALUES ('daemon_url', 'ws://old:4200')",
                [],
            )?;
            conn.execute(
                "INSERT INTO app_settings (key, value, updated_at) \
                 VALUES ('daemon_url', 'ws://new:5000', datetime('now')) \
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                [],
            )?;
            let val: String = conn.query_row(
                "SELECT value FROM app_settings WHERE key = 'daemon_url'",
                [],
                |row| row.get(0),
            )?;
            assert_eq!(val, "ws://new:5000");
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn resolve_daemon_url_falls_back_to_config_value() {
        // Test the no-env-var branch safely: only run assertion if the env is absent.
        if std::env::var("HIVE_DAEMON_URL").is_err() {
            let result = resolve_daemon_url("ws://config-value:4200");
            assert_eq!(result, "ws://config-value:4200");
        }
    }

    #[test]
    fn valid_daemon_url_accepted() {
        assert!(validate_daemon_url("ws://127.0.0.1:4200").is_ok());
        assert!(validate_daemon_url("wss://daemon.example.com").is_ok());
        assert!(validate_daemon_url("http://localhost:4200").is_ok());
        assert!(validate_daemon_url("https://daemon.example.com/api").is_ok());
    }

    #[test]
    fn invalid_daemon_url_rejected() {
        assert!(validate_daemon_url("").is_err());
        assert!(validate_daemon_url("localhost:4200").is_err());
        assert!(validate_daemon_url("ftp://example.com").is_err());
        assert!(validate_daemon_url("tcp://127.0.0.1:4200").is_err());
    }

    #[test]
    fn set_setting_writes_audit_history() {
        let db = test_db();
        db.set_setting("daemon_url", "ws://first:4200", "system")
            .unwrap();
        db.set_setting("daemon_url", "ws://second:4200", "admin")
            .unwrap();

        let history = db.get_setting_history("daemon_url", 10).unwrap();
        assert_eq!(history.len(), 2);
        assert_eq!(history[0].new_value, "ws://second:4200");
        assert_eq!(history[0].old_value.as_deref(), Some("ws://first:4200"));
        assert_eq!(history[0].changed_by, "admin");
        assert_eq!(history[1].new_value, "ws://first:4200");
        assert!(history[1].old_value.is_none());
    }
}
