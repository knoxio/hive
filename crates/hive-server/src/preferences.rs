//! Per-user preferences API (MH-028).
//!
//! Stores and retrieves a structured JSON preferences document per user.
//!
//! | Endpoint                            | Purpose                              |
//! |-------------------------------------|--------------------------------------|
//! | `GET  /api/users/me/preferences`    | Return preferences, defaulting any   |
//! |                                     | missing keys                         |
//! | `PATCH /api/users/me/preferences`   | Merge partial update into stored     |
//! |                                     | preferences                          |
//!
//! Preference structure (all fields optional in PATCH):
//! ```json
//! {
//!   "ui": {
//!     "theme":   "system" | "light" | "dark",
//!     "density": "comfortable" | "compact"
//!   },
//!   "notifications": {
//!     "mentions": true | false,
//!     "dms":      true | false,
//!     "rooms":    true | false
//!   }
//! }
//! ```

use std::sync::Arc;

use axum::extract::State;
use axum::{Extension, Json};
use serde::{Deserialize, Serialize};

use crate::auth::Claims;
use crate::error::HiveError;
use crate::AppState;

// ---------------------------------------------------------------------------
// Preference types
// ---------------------------------------------------------------------------

/// Allowed theme values.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Theme {
    #[default]
    System,
    Light,
    Dark,
}

/// Allowed density values.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Density {
    #[default]
    Comfortable,
    Compact,
}

/// UI display preferences.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UiPrefs {
    #[serde(default)]
    pub theme: Theme,
    #[serde(default)]
    pub density: Density,
}

/// Notification preferences.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationPrefs {
    #[serde(default = "default_true")]
    pub mentions: bool,
    #[serde(default = "default_true")]
    pub dms: bool,
    #[serde(default = "default_false")]
    pub rooms: bool,
}

impl Default for NotificationPrefs {
    fn default() -> Self {
        Self {
            mentions: true,
            dms: true,
            rooms: false,
        }
    }
}

fn default_true() -> bool {
    true
}

fn default_false() -> bool {
    false
}

/// Full preferences document returned by `GET /api/users/me/preferences`.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Preferences {
    #[serde(default)]
    pub ui: UiPrefs,
    #[serde(default)]
    pub notifications: NotificationPrefs,
}

// ---------------------------------------------------------------------------
// PATCH request type — all fields optional for partial updates
// ---------------------------------------------------------------------------

/// Optional UI fields for a PATCH request.
#[derive(Debug, Deserialize)]
pub struct UiPatch {
    pub theme: Option<Theme>,
    pub density: Option<Density>,
}

/// Optional notification fields for a PATCH request.
#[derive(Debug, Deserialize)]
pub struct NotificationPatch {
    pub mentions: Option<bool>,
    pub dms: Option<bool>,
    pub rooms: Option<bool>,
}

/// PATCH /api/users/me/preferences — all top-level fields are optional.
#[derive(Debug, Deserialize)]
pub struct PatchPreferencesRequest {
    pub ui: Option<UiPatch>,
    pub notifications: Option<NotificationPatch>,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// `GET /api/users/me/preferences` — return preferences with defaults applied.
pub(crate) async fn get_preferences(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Preferences>, HiveError> {
    let user_id: i64 = claims
        .sub
        .parse()
        .map_err(|_| HiveError::Internal("invalid user id in claims".into()))?;

    let db = state.db.clone();
    let raw = tokio::task::spawn_blocking(move || db.get_user_prefs(user_id))
        .await
        .map_err(|e| HiveError::Internal(format!("task error: {e}")))?
        .map_err(|e| HiveError::Internal(format!("db error: {e}")))?;

    let prefs: Preferences = serde_json::from_str(&raw).unwrap_or_default();

    Ok(Json(prefs))
}

/// `PATCH /api/users/me/preferences` — merge partial update and persist.
pub(crate) async fn patch_preferences(
    State(state): State<Arc<AppState>>,
    Extension(claims): Extension<Claims>,
    Json(patch): Json<PatchPreferencesRequest>,
) -> Result<Json<Preferences>, HiveError> {
    let user_id: i64 = claims
        .sub
        .parse()
        .map_err(|_| HiveError::Internal("invalid user id in claims".into()))?;

    let db = state.db.clone();

    // Load current preferences.
    let raw = tokio::task::spawn_blocking({
        let db = db.clone();
        move || db.get_user_prefs(user_id)
    })
    .await
    .map_err(|e| HiveError::Internal(format!("task error: {e}")))?
    .map_err(|e| HiveError::Internal(format!("db error: {e}")))?;

    let mut prefs: Preferences = serde_json::from_str(&raw).unwrap_or_default();

    // Apply partial UI patch.
    if let Some(ui) = patch.ui {
        if let Some(theme) = ui.theme {
            prefs.ui.theme = theme;
        }
        if let Some(density) = ui.density {
            prefs.ui.density = density;
        }
    }

    // Apply partial notifications patch.
    if let Some(notif) = patch.notifications {
        if let Some(v) = notif.mentions {
            prefs.notifications.mentions = v;
        }
        if let Some(v) = notif.dms {
            prefs.notifications.dms = v;
        }
        if let Some(v) = notif.rooms {
            prefs.notifications.rooms = v;
        }
    }

    // Persist merged document.
    let json = serde_json::to_string(&prefs)
        .map_err(|e| HiveError::Internal(format!("serialise error: {e}")))?;

    tokio::task::spawn_blocking(move || db.set_user_prefs(user_id, &json))
        .await
        .map_err(|e| HiveError::Internal(format!("task error: {e}")))?
        .map_err(|e| HiveError::Internal(format!("db error: {e}")))?;

    tracing::info!(user_id, "preferences updated");

    Ok(Json(prefs))
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    // --- Default value tests ---

    #[test]
    fn default_preferences_has_system_theme() {
        let p = Preferences::default();
        assert_eq!(p.ui.theme, Theme::System);
    }

    #[test]
    fn default_preferences_has_comfortable_density() {
        let p = Preferences::default();
        assert_eq!(p.ui.density, Density::Comfortable);
    }

    #[test]
    fn default_preferences_notifications_mentions_true() {
        let p = Preferences::default();
        assert!(p.notifications.mentions);
    }

    #[test]
    fn default_preferences_notifications_dms_true() {
        let p = Preferences::default();
        assert!(p.notifications.dms);
    }

    #[test]
    fn default_preferences_notifications_rooms_false() {
        let p = Preferences::default();
        assert!(!p.notifications.rooms);
    }

    // --- Serialisation round-trip ---

    #[test]
    fn preferences_roundtrip() {
        let p = Preferences {
            ui: UiPrefs {
                theme: Theme::Dark,
                density: Density::Compact,
            },
            notifications: NotificationPrefs {
                mentions: false,
                dms: true,
                rooms: true,
            },
        };
        let json = serde_json::to_string(&p).unwrap();
        let p2: Preferences = serde_json::from_str(&json).unwrap();
        assert_eq!(p2.ui.theme, Theme::Dark);
        assert_eq!(p2.ui.density, Density::Compact);
        assert!(!p2.notifications.mentions);
        assert!(p2.notifications.dms);
        assert!(p2.notifications.rooms);
    }

    #[test]
    fn empty_json_deserialises_to_defaults() {
        let p: Preferences = serde_json::from_str("{}").unwrap();
        assert_eq!(p.ui.theme, Theme::System);
        assert!(p.notifications.mentions);
    }

    // --- Patch merge logic ---

    #[test]
    fn patch_merges_theme_only() {
        let mut prefs = Preferences::default();
        // Apply theme patch.
        let patch = PatchPreferencesRequest {
            ui: Some(UiPatch {
                theme: Some(Theme::Light),
                density: None,
            }),
            notifications: None,
        };
        if let Some(ui) = patch.ui {
            if let Some(theme) = ui.theme {
                prefs.ui.theme = theme;
            }
            if let Some(density) = ui.density {
                prefs.ui.density = density;
            }
        }
        assert_eq!(prefs.ui.theme, Theme::Light);
        // Density unchanged.
        assert_eq!(prefs.ui.density, Density::Comfortable);
    }

    #[test]
    fn patch_merges_notifications_only() {
        let mut prefs = Preferences::default();
        let patch = PatchPreferencesRequest {
            ui: None,
            notifications: Some(NotificationPatch {
                mentions: None,
                dms: None,
                rooms: Some(true),
            }),
        };
        if let Some(notif) = patch.notifications {
            if let Some(v) = notif.mentions {
                prefs.notifications.mentions = v;
            }
            if let Some(v) = notif.dms {
                prefs.notifications.dms = v;
            }
            if let Some(v) = notif.rooms {
                prefs.notifications.rooms = v;
            }
        }
        // Only rooms changed.
        assert!(prefs.notifications.rooms);
        assert!(prefs.notifications.mentions); // unchanged
        assert!(prefs.notifications.dms); // unchanged
    }

    // --- DB helper tests ---

    #[test]
    fn get_user_prefs_returns_empty_object_for_missing_user() {
        let db = crate::db::Database::open_memory().unwrap();
        // user_id 999 has no row — should return "{}".
        let raw = db.get_user_prefs(999).unwrap();
        assert_eq!(raw, "{}");
    }

    #[test]
    fn set_and_get_user_prefs_roundtrip() {
        let db = crate::db::Database::open_memory().unwrap();
        // Insert a local_users row to satisfy FK.
        db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO local_users (id, username, password_hash, role) \
                 VALUES (1, 'alice', 'hash', 'user')",
                [],
            )?;
            Ok(())
        })
        .unwrap();

        let prefs_json = r#"{"ui":{"theme":"dark","density":"comfortable"}}"#;
        db.set_user_prefs(1, prefs_json).unwrap();

        let retrieved = db.get_user_prefs(1).unwrap();
        assert_eq!(retrieved, prefs_json);
    }

    #[test]
    fn set_user_prefs_upserts_on_second_call() {
        let db = crate::db::Database::open_memory().unwrap();
        db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO local_users (id, username, password_hash, role) \
                 VALUES (2, 'bob', 'hash', 'user')",
                [],
            )?;
            Ok(())
        })
        .unwrap();

        db.set_user_prefs(2, r#"{"ui":{"theme":"light"}}"#).unwrap();
        db.set_user_prefs(2, r#"{"ui":{"theme":"dark"}}"#).unwrap();

        let retrieved = db.get_user_prefs(2).unwrap();
        assert!(retrieved.contains("dark"));
        assert!(!retrieved.contains("light"));
    }
}
