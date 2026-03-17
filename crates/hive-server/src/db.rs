//! SQLite database setup and migration for Hive.
//!
//! Manages the Hive-specific state: users, workspaces, workspace-room
//! mappings, API keys, and team manifests. Room-side data (messages,
//! tokens, subscriptions) remains in room's own storage.

use std::path::Path;
use std::sync::{Arc, Mutex};

use rusqlite::Connection;

/// Schema version — bump when adding new migrations.
const SCHEMA_VERSION: i64 = 6;

/// SQL statements for schema v1.
const SCHEMA_V1: &str = r#"
CREATE TABLE IF NOT EXISTS users (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    provider    TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    email       TEXT,
    display_name TEXT,
    room_token  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(provider, provider_id)
);

CREATE TABLE IF NOT EXISTS workspaces (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    owner_id    INTEGER NOT NULL REFERENCES users(id),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS workspace_rooms (
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    room_id      TEXT NOT NULL,
    added_at     TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (workspace_id, room_id)
);

CREATE TABLE IF NOT EXISTS api_keys (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key_hash    TEXT NOT NULL UNIQUE,
    label       TEXT,
    scopes      TEXT NOT NULL DEFAULT '*',
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at  TEXT
);

CREATE TABLE IF NOT EXISTS team_manifests (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    workspace_id  INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    name          TEXT NOT NULL,
    manifest_json TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
"#;

/// SQL statements for schema v2 — app settings key/value store.
const SCHEMA_V2: &str = r#"
CREATE TABLE IF NOT EXISTS app_settings (
    key         TEXT PRIMARY KEY,
    value       TEXT NOT NULL,
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_by  TEXT
);
"#;

/// SQL statements for schema v3 — JWT auth tables.
const SCHEMA_V3: &str = r#"
CREATE TABLE IF NOT EXISTS local_users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user',
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS revoked_tokens (
    jti        TEXT PRIMARY KEY,
    user_id    INTEGER,
    expires_at TEXT NOT NULL,
    revoked_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"#;

/// SQL statements for schema v4 — settings change history.
const SCHEMA_V4: &str = r#"
CREATE TABLE IF NOT EXISTS app_settings_history (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    key        TEXT NOT NULL,
    old_value  TEXT,
    new_value  TEXT NOT NULL,
    changed_by TEXT NOT NULL DEFAULT 'system',
    changed_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"#;

/// SQL statements for schema v5 — user management fields.
const SCHEMA_V5: &str = r#"
ALTER TABLE local_users ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
"#;

/// SQL statements for schema v6 — per-user preferences.
const SCHEMA_V6: &str = r#"
CREATE TABLE IF NOT EXISTS user_preferences (
    user_id    INTEGER PRIMARY KEY REFERENCES local_users(id) ON DELETE CASCADE,
    prefs_json TEXT NOT NULL DEFAULT '{}',
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"#;

/// A row from `app_settings_history`.
#[derive(Debug, Clone)]
pub struct SettingHistoryRow {
    pub id: i64,
    pub key: String,
    pub old_value: Option<String>,
    pub new_value: String,
    pub changed_by: String,
    pub changed_at: String,
}

/// Thread-safe database handle.
///
/// Uses a `Mutex<Connection>` for synchronous SQLite access from async
/// handlers via `spawn_blocking`. SQLite in WAL mode supports concurrent
/// readers but single writer — the mutex serializes writes.
#[derive(Clone)]
pub struct Database {
    conn: Arc<Mutex<Connection>>,
}

impl Database {
    /// Open (or create) the database at `path` and run migrations.
    pub fn open(path: &Path) -> Result<Self, rusqlite::Error> {
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;")?;

        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        db.migrate()?;
        Ok(db)
    }

    /// Open an in-memory database (for tests).
    pub fn open_memory() -> Result<Self, rusqlite::Error> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch("PRAGMA foreign_keys=ON;")?;

        let db = Self {
            conn: Arc::new(Mutex::new(conn)),
        };
        db.migrate()?;
        Ok(db)
    }

    /// Run schema migrations up to `SCHEMA_VERSION`.
    fn migrate(&self) -> Result<(), rusqlite::Error> {
        let conn = self.conn.lock().expect("db lock poisoned");

        // Create migration tracking table
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS _migrations (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL DEFAULT (datetime('now'))
            )",
        )?;

        let current: i64 = conn
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM _migrations",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        if current < 1 {
            conn.execute_batch(SCHEMA_V1)?;
            conn.execute("INSERT INTO _migrations (version) VALUES (1)", [])?;
            tracing::info!("database migrated to schema v1");
        }

        if current < 2 {
            conn.execute_batch(SCHEMA_V2)?;
            conn.execute("INSERT INTO _migrations (version) VALUES (2)", [])?;
            tracing::info!("database migrated to schema v2");
        }

        if current < 3 {
            conn.execute_batch(SCHEMA_V3)?;
            conn.execute("INSERT INTO _migrations (version) VALUES (3)", [])?;
            tracing::info!("database migrated to schema v3");
        }

        if current < 4 {
            conn.execute_batch(SCHEMA_V4)?;
            conn.execute("INSERT INTO _migrations (version) VALUES (4)", [])?;
            tracing::info!("database migrated to schema v4");
        }

        if current < 5 {
            conn.execute_batch(SCHEMA_V5)?;
            conn.execute("INSERT INTO _migrations (version) VALUES (5)", [])?;
            tracing::info!("database migrated to schema v5");
        }

        if current < 6 {
            conn.execute_batch(SCHEMA_V6)?;
            conn.execute("INSERT INTO _migrations (version) VALUES (6)", [])?;
            tracing::info!("database migrated to schema v6");
        }

        let final_version: i64 = conn.query_row(
            "SELECT COALESCE(MAX(version), 0) FROM _migrations",
            [],
            |row| row.get(0),
        )?;
        tracing::info!("database schema at v{final_version} (target: v{SCHEMA_VERSION})");

        Ok(())
    }

    /// Execute a closure with the database connection.
    ///
    /// Callers should keep the closure short to avoid holding the mutex.
    pub fn with_conn<F, T>(&self, f: F) -> Result<T, rusqlite::Error>
    where
        F: FnOnce(&Connection) -> Result<T, rusqlite::Error>,
    {
        let conn = self.conn.lock().expect("db lock poisoned");
        f(&conn)
    }

    /// Return the current value for `key`, or `None` if not set.
    pub fn get_setting(&self, key: &str) -> Result<Option<String>, rusqlite::Error> {
        self.with_conn(|conn| {
            match conn.query_row(
                "SELECT value FROM app_settings WHERE key = ?1",
                [key],
                |row| row.get(0),
            ) {
                Ok(v) => Ok(Some(v)),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
                Err(e) => Err(e),
            }
        })
    }

    /// Upsert a setting value, update `updated_by`, and record the change in
    /// `app_settings_history`.
    ///
    /// `changed_by` should be a username or `"system"` for automatic changes.
    pub fn set_setting(
        &self,
        key: &str,
        value: &str,
        changed_by: &str,
    ) -> Result<(), rusqlite::Error> {
        self.with_conn(|conn| {
            let old_value: Option<String> = match conn.query_row(
                "SELECT value FROM app_settings WHERE key = ?1",
                [key],
                |row| row.get(0),
            ) {
                Ok(v) => Some(v),
                Err(rusqlite::Error::QueryReturnedNoRows) => None,
                Err(e) => return Err(e),
            };

            conn.execute(
                "INSERT INTO app_settings (key, value, updated_at, updated_by) \
                 VALUES (?1, ?2, datetime('now'), ?3) \
                 ON CONFLICT(key) DO UPDATE SET \
                     value = excluded.value, \
                     updated_at = excluded.updated_at, \
                     updated_by = excluded.updated_by",
                rusqlite::params![key, value, changed_by],
            )?;

            conn.execute(
                "INSERT INTO app_settings_history (key, old_value, new_value, changed_by) \
                 VALUES (?1, ?2, ?3, ?4)",
                rusqlite::params![key, old_value, value, changed_by],
            )?;

            Ok(())
        })
    }

    /// Return the stored preferences JSON for `user_id`, or `"{}"` if none set.
    pub fn get_user_prefs(&self, user_id: i64) -> Result<String, rusqlite::Error> {
        self.with_conn(|conn| {
            match conn.query_row(
                "SELECT prefs_json FROM user_preferences WHERE user_id = ?1",
                [user_id],
                |row| row.get(0),
            ) {
                Ok(v) => Ok(v),
                Err(rusqlite::Error::QueryReturnedNoRows) => Ok("{}".to_owned()),
                Err(e) => Err(e),
            }
        })
    }

    /// Upsert (replace) the preferences JSON for `user_id`.
    pub fn set_user_prefs(&self, user_id: i64, prefs_json: &str) -> Result<(), rusqlite::Error> {
        self.with_conn(|conn| {
            conn.execute(
                "INSERT INTO user_preferences (user_id, prefs_json, updated_at) \
                 VALUES (?1, ?2, datetime('now')) \
                 ON CONFLICT(user_id) DO UPDATE SET \
                     prefs_json = excluded.prefs_json, \
                     updated_at = excluded.updated_at",
                rusqlite::params![user_id, prefs_json],
            )?;
            Ok(())
        })
    }

    /// Return the last `limit` history entries for `key`, newest first.
    pub fn get_setting_history(
        &self,
        key: &str,
        limit: i64,
    ) -> Result<Vec<SettingHistoryRow>, rusqlite::Error> {
        self.with_conn(|conn| {
            let mut stmt = conn.prepare(
                "SELECT id, key, old_value, new_value, changed_by, changed_at \
                 FROM app_settings_history \
                 WHERE key = ?1 \
                 ORDER BY changed_at DESC, id DESC \
                 LIMIT ?2",
            )?;
            let rows = stmt.query_map(rusqlite::params![key, limit], |row| {
                Ok(SettingHistoryRow {
                    id: row.get(0)?,
                    key: row.get(1)?,
                    old_value: row.get(2)?,
                    new_value: row.get(3)?,
                    changed_by: row.get(4)?,
                    changed_at: row.get(5)?,
                })
            })?;
            rows.collect()
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn open_memory_creates_tables() {
        let db = Database::open_memory().unwrap();
        db.with_conn(|conn| {
            let mut stmt =
                conn.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")?;
            let names: Vec<String> = stmt
                .query_map([], |row| row.get(0))?
                .collect::<Result<Vec<_>, _>>()?;
            assert!(names.contains(&"users".to_owned()));
            assert!(names.contains(&"workspaces".to_owned()));
            assert!(names.contains(&"workspace_rooms".to_owned()));
            assert!(names.contains(&"api_keys".to_owned()));
            assert!(names.contains(&"team_manifests".to_owned()));
            assert!(names.contains(&"app_settings".to_owned()));
            assert!(names.contains(&"app_settings_history".to_owned()));
            assert!(names.contains(&"local_users".to_owned()));
            assert!(names.contains(&"revoked_tokens".to_owned()));
            assert!(names.contains(&"_migrations".to_owned()));
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn migration_is_idempotent() {
        let db = Database::open_memory().unwrap();
        // Running migrate again should not fail
        db.migrate().unwrap();
        db.migrate().unwrap();

        db.with_conn(|conn| {
            let version: i64 =
                conn.query_row("SELECT MAX(version) FROM _migrations", [], |row| row.get(0))?;
            assert_eq!(version, SCHEMA_VERSION);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn foreign_keys_enforced() {
        let db = Database::open_memory().unwrap();
        let result = db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO workspaces (name, owner_id) VALUES ('test', 999)",
                [],
            )
        });
        // Should fail — owner_id 999 doesn't exist in users
        assert!(result.is_err());
    }

    #[test]
    fn insert_user_and_workspace() {
        let db = Database::open_memory().unwrap();
        db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO users (provider, provider_id, email, display_name) VALUES ('github', '12345', 'test@example.com', 'Test User')",
                [],
            )?;
            let user_id: i64 = conn.query_row(
                "SELECT id FROM users WHERE provider_id = '12345'",
                [],
                |row| row.get(0),
            )?;

            conn.execute(
                "INSERT INTO workspaces (name, owner_id) VALUES ('my-workspace', ?1)",
                [user_id],
            )?;
            let ws_name: String = conn.query_row(
                "SELECT name FROM workspaces WHERE owner_id = ?1",
                [user_id],
                |row| row.get(0),
            )?;
            assert_eq!(ws_name, "my-workspace");
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn workspace_room_membership() {
        let db = Database::open_memory().unwrap();
        db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO users (provider, provider_id) VALUES ('github', '1')",
                [],
            )?;
            conn.execute(
                "INSERT INTO workspaces (name, owner_id) VALUES ('ws', 1)",
                [],
            )?;
            conn.execute(
                "INSERT INTO workspace_rooms (workspace_id, room_id) VALUES (1, 'room-dev')",
                [],
            )?;
            conn.execute(
                "INSERT INTO workspace_rooms (workspace_id, room_id) VALUES (1, 'room-staging')",
                [],
            )?;

            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM workspace_rooms WHERE workspace_id = 1",
                [],
                |row| row.get(0),
            )?;
            assert_eq!(count, 2);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn cascade_delete_workspace_removes_rooms() {
        let db = Database::open_memory().unwrap();
        db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO users (provider, provider_id) VALUES ('github', '1')",
                [],
            )?;
            conn.execute(
                "INSERT INTO workspaces (name, owner_id) VALUES ('ws', 1)",
                [],
            )?;
            conn.execute(
                "INSERT INTO workspace_rooms (workspace_id, room_id) VALUES (1, 'room-a')",
                [],
            )?;

            // Delete workspace — should cascade to workspace_rooms
            conn.execute("DELETE FROM workspaces WHERE id = 1", [])?;

            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM workspace_rooms WHERE workspace_id = 1",
                [],
                |row| row.get(0),
            )?;
            assert_eq!(count, 0);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn unique_user_constraint() {
        let db = Database::open_memory().unwrap();
        db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO users (provider, provider_id) VALUES ('github', '1')",
                [],
            )?;
            let result = conn.execute(
                "INSERT INTO users (provider, provider_id) VALUES ('github', '1')",
                [],
            );
            assert!(result.is_err());
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn open_file_database() {
        let dir = tempfile::TempDir::new().unwrap();
        let db_path = dir.path().join("hive.db");
        let db = Database::open(&db_path).unwrap();

        db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO users (provider, provider_id) VALUES ('test', '1')",
                [],
            )?;
            Ok(())
        })
        .unwrap();

        // Reopen — data should persist
        let db2 = Database::open(&db_path).unwrap();
        db2.with_conn(|conn| {
            let count: i64 = conn.query_row("SELECT COUNT(*) FROM users", [], |row| row.get(0))?;
            assert_eq!(count, 1);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn setting_set_and_get() {
        let db = Database::open_memory().unwrap();
        assert!(db.get_setting("daemon_url").unwrap().is_none());

        db.set_setting("daemon_url", "ws://first:4200", "system")
            .unwrap();
        assert_eq!(
            db.get_setting("daemon_url").unwrap().as_deref(),
            Some("ws://first:4200")
        );

        db.set_setting("daemon_url", "ws://second:4200", "admin")
            .unwrap();
        assert_eq!(
            db.get_setting("daemon_url").unwrap().as_deref(),
            Some("ws://second:4200")
        );

        let history = db.get_setting_history("daemon_url", 10).unwrap();
        assert_eq!(history.len(), 2);
        assert_eq!(history[0].new_value, "ws://second:4200");
        assert_eq!(history[0].changed_by, "admin");
    }

    #[test]
    fn setting_history_limit_respected() {
        let db = Database::open_memory().unwrap();
        for i in 0..10 {
            db.set_setting("daemon_url", &format!("ws://host:{}", 4200 + i), "system")
                .unwrap();
        }
        let history = db.get_setting_history("daemon_url", 5).unwrap();
        assert_eq!(history.len(), 5);
    }

    #[test]
    fn setting_history_unknown_key_empty() {
        let db = Database::open_memory().unwrap();
        let history = db.get_setting_history("nonexistent", 10).unwrap();
        assert!(history.is_empty());
    }
}
