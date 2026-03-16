//! Hive server configuration.
//!
//! Loaded from `hive.toml` (or path specified via `--config`). Falls back to
//! sensible defaults when the file is missing.

use std::path::{Path, PathBuf};

use serde::Deserialize;

/// Top-level Hive server configuration.
#[derive(Debug, Deserialize)]
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

impl Default for HiveConfig {
    fn default() -> Self {
        Self {
            server: ServerConfig::default(),
            daemon: DaemonConfig::default(),
        }
    }
}

impl Default for ServerConfig {
    fn default() -> Self {
        let data_dir = dirs::home_dir()
            .map(|h| h.join(".hive").join("data"))
            .unwrap_or_else(|| PathBuf::from("data"))
            .to_string_lossy()
            .into_owned();
        Self {
            host: "127.0.0.1".to_owned(),
            port: 3000,
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
