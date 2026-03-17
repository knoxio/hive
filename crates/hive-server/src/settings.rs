//! App settings API — runtime configuration stored in the database.
//!
//! Exposes `GET /api/settings` and `PATCH /api/settings` to read and update
//! key/value settings. The `daemon_url` setting controls which room daemon
//! all subsequent proxy calls target.
//!
//! On first run, seeds defaults from environment variables (see [`seed_defaults`]).

use std::collections::HashMap;
use std::sync::Arc;

use axum::extract::State;
use axum::http::StatusCode;
use axum::response::IntoResponse;
use axum::Json;
use serde::Deserialize;

use crate::AppState;

/// Known setting keys.
pub const KEY_DAEMON_URL: &str = "daemon_url";

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

    let result = state.db.with_conn(|conn| {
        for (key, value) in &updates {
            conn.execute(
                "INSERT INTO app_settings (key, value, updated_at) \
                 VALUES (?1, ?2, datetime('now')) \
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at",
                rusqlite::params![key, value],
            )?;
        }
        Ok(())
    });

    match result {
        Ok(()) => {
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
        Err(e) => {
            tracing::error!("failed to update settings: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, "internal error").into_response()
        }
    }
}

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
}
