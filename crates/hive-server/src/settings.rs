//! App settings API — MH-029.
//!
//! Provides `GET /api/settings`, `PATCH /api/settings`, and
//! `GET /api/settings/history` endpoints. Settings are persisted in the
//! `app_settings` SQLite table; every change is audited in
//! `app_settings_history`.
//!
//! Admin-only restriction is a placeholder; full enforcement requires
//! MH-013 (basic token auth) which is implemented in Wave 2.

use std::sync::Arc;

use axum::{
    extract::{Query, State},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};

use crate::{db::SettingHistoryRow, error::HiveError, AppState};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/// All editable app settings returned by `GET /api/settings`.
#[derive(Debug, Serialize)]
pub struct AppSettings {
    /// WebSocket URL of the room daemon (e.g. `ws://127.0.0.1:4200`).
    pub daemon_url: String,
}

/// Request body for `PATCH /api/settings`.
#[derive(Debug, Deserialize)]
pub struct PatchSettingsRequest {
    /// New daemon WebSocket URL. Must be a valid `ws://`, `wss://`,
    /// `http://`, or `https://` URL.
    pub daemon_url: Option<String>,
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

/// Query parameters for `GET /api/settings/history`.
#[derive(Debug, Deserialize)]
pub struct HistoryQuery {
    pub key: Option<String>,
    pub limit: Option<i64>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAEMON_URL_KEY: &str = "daemon_url";

/// Valid URL schemes for the daemon URL.
const VALID_SCHEMES: &[&str] = &["ws", "wss", "http", "https"];

/// Validate a daemon URL: must parse as a URL and have an accepted scheme.
fn validate_daemon_url(raw: &str) -> Result<(), HiveError> {
    let parsed = reqwest::Url::parse(raw)
        .map_err(|_| HiveError::BadRequest(format!("invalid URL: {raw}")))?;

    if !VALID_SCHEMES.contains(&parsed.scheme()) {
        return Err(HiveError::BadRequest(format!(
            "invalid scheme '{}': must be one of ws, wss, http, https",
            parsed.scheme()
        )));
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/settings` — return current app configuration.
pub async fn get_settings(
    State(state): State<Arc<AppState>>,
) -> Result<Json<AppSettings>, HiveError> {
    let db = state.db.clone();
    let daemon_url = tokio::task::spawn_blocking(move || db.get_setting(DAEMON_URL_KEY))
        .await
        .map_err(|e| HiveError::Internal(e.to_string()))?
        .map_err(|e| HiveError::Internal(e.to_string()))?
        .unwrap_or_else(|| state.config.daemon.ws_url.clone());

    Ok(Json(AppSettings { daemon_url }))
}

/// `PATCH /api/settings` — update editable settings.
///
/// Returns the updated settings on success. Restricted to admin users
/// (enforcement pending MH-013).
pub async fn patch_settings(
    State(state): State<Arc<AppState>>,
    Json(body): Json<PatchSettingsRequest>,
) -> Result<(StatusCode, Json<AppSettings>), HiveError> {
    if body.daemon_url.is_none() {
        return Err(HiveError::BadRequest("no fields to update".to_owned()));
    }

    if let Some(ref url) = body.daemon_url {
        validate_daemon_url(url)?;
    }

    let db = state.db.clone();
    let url = body.daemon_url.unwrap();
    let url_for_block = url.clone();

    tokio::task::spawn_blocking(move || db.set_setting(DAEMON_URL_KEY, &url_for_block, "system"))
        .await
        .map_err(|e| HiveError::Internal(e.to_string()))?
        .map_err(|e| HiveError::Internal(e.to_string()))?;

    // Best-effort WS broadcast — full reconnect wiring requires MH-027.
    tracing::info!(daemon_url = %url, "settings_changed: daemon_url updated");

    Ok((StatusCode::OK, Json(AppSettings { daemon_url: url })))
}

/// `GET /api/settings/history` — return change log for a settings key.
///
/// Query params:
/// - `key` (default: `daemon_url`)
/// - `limit` (default: 5, max: 100)
pub async fn get_settings_history(
    State(state): State<Arc<AppState>>,
    Query(params): Query<HistoryQuery>,
) -> Result<Json<Vec<SettingHistoryItem>>, HiveError> {
    let key = params.key.unwrap_or_else(|| DAEMON_URL_KEY.to_owned());
    let limit = params.limit.unwrap_or(5).clamp(1, 100);

    let db = state.db.clone();
    let rows = tokio::task::spawn_blocking(move || db.get_setting_history(&key, limit))
        .await
        .map_err(|e| HiveError::Internal(e.to_string()))?
        .map_err(|e| HiveError::Internal(e.to_string()))?;

    Ok(Json(rows.into_iter().map(Into::into).collect()))
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn valid_ws_url_accepted() {
        assert!(validate_daemon_url("ws://127.0.0.1:4200").is_ok());
        assert!(validate_daemon_url("wss://daemon.example.com").is_ok());
        assert!(validate_daemon_url("http://localhost:4200").is_ok());
        assert!(validate_daemon_url("https://daemon.example.com/api").is_ok());
    }

    #[test]
    fn bare_hostname_rejected() {
        assert!(validate_daemon_url("localhost:4200").is_err());
        assert!(validate_daemon_url("daemon.example.com").is_err());
    }

    #[test]
    fn unsupported_scheme_rejected() {
        assert!(validate_daemon_url("ftp://example.com").is_err());
        assert!(validate_daemon_url("tcp://127.0.0.1:4200").is_err());
    }

    #[test]
    fn empty_string_rejected() {
        assert!(validate_daemon_url("").is_err());
    }

    #[test]
    fn setting_roundtrip_in_memory() {
        let db = crate::db::Database::open_memory().unwrap();

        // Initially absent
        assert!(db.get_setting("daemon_url").unwrap().is_none());

        // Set and retrieve
        db.set_setting("daemon_url", "ws://127.0.0.1:4200", "system")
            .unwrap();
        assert_eq!(
            db.get_setting("daemon_url").unwrap().as_deref(),
            Some("ws://127.0.0.1:4200")
        );

        // Update and check history
        db.set_setting("daemon_url", "wss://new.example.com", "admin")
            .unwrap();
        assert_eq!(
            db.get_setting("daemon_url").unwrap().as_deref(),
            Some("wss://new.example.com")
        );

        let history = db.get_setting_history("daemon_url", 5).unwrap();
        assert_eq!(history.len(), 2);
        // Newest first
        assert_eq!(history[0].new_value, "wss://new.example.com");
        assert_eq!(history[0].old_value.as_deref(), Some("ws://127.0.0.1:4200"));
        assert_eq!(history[0].changed_by, "admin");
        assert_eq!(history[1].new_value, "ws://127.0.0.1:4200");
        assert!(history[1].old_value.is_none());
    }

    #[test]
    fn history_limit_respected() {
        let db = crate::db::Database::open_memory().unwrap();

        for i in 0..10 {
            db.set_setting("daemon_url", &format!("ws://host:{}", 4200 + i), "system")
                .unwrap();
        }

        let history = db.get_setting_history("daemon_url", 5).unwrap();
        assert_eq!(history.len(), 5);
    }

    #[test]
    fn history_for_unknown_key_is_empty() {
        let db = crate::db::Database::open_memory().unwrap();
        let history = db.get_setting_history("nonexistent_key", 10).unwrap();
        assert!(history.is_empty());
    }
}
