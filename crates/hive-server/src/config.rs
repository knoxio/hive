//! Hive server configuration.
//!
//! Loaded from `hive.toml` (or path specified via `--config`). Falls back to
//! sensible defaults when the file is missing.

use std::path::{Path, PathBuf};

use serde::Deserialize;

/// Top-level Hive server configuration.
#[derive(Debug, Default, Deserialize)]
#[serde(default)]
pub struct HiveConfig {
    /// HTTP server settings.
    pub server: ServerConfig,
    /// Room daemon connection settings.
    pub daemon: DaemonConfig,
}

/// HTTP server bind configuration.
#[derive(Debug, Deserialize)]
#[serde(default)]
pub struct ServerConfig {
    /// Address to bind the HTTP server to.
    pub host: String,
    /// Port for the HTTP server.
    pub port: u16,
    /// Directory for persistent data (SQLite database, etc.).
    pub data_dir: String,
}

/// Room daemon connection configuration.
#[derive(Debug, Deserialize)]
#[serde(default)]
pub struct DaemonConfig {
    /// Path to the room daemon Unix socket.
    pub socket_path: PathBuf,
    /// WebSocket URL of the room daemon (e.g. ws://127.0.0.1:4200).
    pub ws_url: String,
}

impl Default for ServerConfig {
    fn default() -> Self {
        let host = std::env::var("HIVE_HOST").unwrap_or_else(|_| "127.0.0.1".to_owned());
        let port = std::env::var("HIVE_PORT")
            .ok()
            .and_then(|p| p.parse().ok())
            .unwrap_or(3000);
        let data_dir = std::env::var("HIVE_DATA_DIR").unwrap_or_else(|_| {
            let home = std::env::var("HOME").unwrap_or_else(|_| "/tmp".to_owned());
            format!("{home}/.hive/data")
        });
        Self {
            host,
            port,
            data_dir,
        }
    }
}

impl Default for DaemonConfig {
    fn default() -> Self {
        Self {
            socket_path: PathBuf::from("/tmp/roomd.sock"),
            ws_url: "ws://127.0.0.1:4200".to_owned(),
        }
    }
}

/// Load configuration from a TOML file, falling back to defaults.
pub fn load_config(path: &Path) -> HiveConfig {
    match std::fs::read_to_string(path) {
        Ok(content) => toml::from_str(&content).unwrap_or_else(|e| {
            eprintln!(
                "[hive] warning: invalid config {}: {e} — using defaults",
                path.display()
            );
            HiveConfig::default()
        }),
        Err(_) => {
            eprintln!("[hive] no config at {} — using defaults", path.display());
            HiveConfig::default()
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;
    use std::sync::Mutex;

    /// Serializes env-var tests to prevent inter-test pollution.
    ///
    /// `set_var`/`remove_var` are unsafe (not thread-safe) since Rust 1.84.
    /// All tests that mutate env vars must hold this lock for their duration.
    static ENV_MUTEX: Mutex<()> = Mutex::new(());

    #[test]
    fn load_config_parses_valid_toml() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("hive.toml");
        std::fs::write(
            &path,
            r#"
[server]
host = "0.0.0.0"
port = 8080
data_dir = "/tmp/hive-test-data"

[daemon]
socket_path = "/tmp/custom.sock"
ws_url = "ws://127.0.0.1:9000"
"#,
        )
        .unwrap();

        let cfg = load_config(&path);

        assert_eq!(cfg.server.host, "0.0.0.0");
        assert_eq!(cfg.server.port, 8080);
        assert_eq!(cfg.server.data_dir, "/tmp/hive-test-data");
        assert_eq!(cfg.daemon.socket_path, PathBuf::from("/tmp/custom.sock"));
        assert_eq!(cfg.daemon.ws_url, "ws://127.0.0.1:9000");
    }

    #[test]
    fn load_config_missing_file_returns_defaults() {
        let cfg = load_config(Path::new("/nonexistent/no-such-file/hive.toml"));

        // Defaults are env-dependent; just verify the struct is well-formed.
        assert!(!cfg.daemon.ws_url.is_empty());
        assert_eq!(cfg.daemon.socket_path, PathBuf::from("/tmp/roomd.sock"));
    }

    #[test]
    fn load_config_invalid_toml_returns_defaults() {
        let dir = tempfile::TempDir::new().unwrap();
        let path = dir.path().join("hive.toml");
        std::fs::write(&path, "this is ][ not [valid toml at all").unwrap();

        let cfg = load_config(&path);

        assert_eq!(cfg.daemon.socket_path, PathBuf::from("/tmp/roomd.sock"));
        assert_eq!(cfg.daemon.ws_url, "ws://127.0.0.1:4200");
    }

    #[test]
    fn server_config_default_reads_env_vars() {
        let _guard = ENV_MUTEX.lock().unwrap();
        // SAFETY: single-threaded access guaranteed by ENV_MUTEX.
        unsafe {
            std::env::set_var("HIVE_HOST", "10.0.0.1");
            std::env::set_var("HIVE_PORT", "9999");
            std::env::set_var("HIVE_DATA_DIR", "/custom/data");
        }
        let cfg = ServerConfig::default();
        // SAFETY: same lock held.
        unsafe {
            std::env::remove_var("HIVE_HOST");
            std::env::remove_var("HIVE_PORT");
            std::env::remove_var("HIVE_DATA_DIR");
        }

        assert_eq!(cfg.host, "10.0.0.1");
        assert_eq!(cfg.port, 9999);
        assert_eq!(cfg.data_dir, "/custom/data");
    }

    #[test]
    fn server_config_default_hardcoded_fallbacks() {
        let _guard = ENV_MUTEX.lock().unwrap();
        // SAFETY: single-threaded access guaranteed by ENV_MUTEX.
        unsafe {
            std::env::remove_var("HIVE_HOST");
            std::env::remove_var("HIVE_PORT");
            std::env::remove_var("HIVE_DATA_DIR");
        }
        let cfg = ServerConfig::default();

        assert_eq!(cfg.host, "127.0.0.1");
        assert_eq!(cfg.port, 3000);
        assert!(
            cfg.data_dir.ends_with("/.hive/data"),
            "expected data_dir to end with /.hive/data, got: {}",
            cfg.data_dir
        );
    }

    #[test]
    fn server_config_invalid_port_env_uses_default() {
        let _guard = ENV_MUTEX.lock().unwrap();
        unsafe {
            std::env::set_var("HIVE_PORT", "not-a-number");
            std::env::remove_var("HIVE_HOST");
            std::env::remove_var("HIVE_DATA_DIR");
        }
        let cfg = ServerConfig::default();
        unsafe {
            std::env::remove_var("HIVE_PORT");
        }

        assert_eq!(cfg.port, 3000, "invalid HIVE_PORT should fall back to 3000");
    }
}
