mod config;
pub mod daemon;
pub mod db;
pub mod error;
mod ws_relay;

use std::path::PathBuf;
use std::sync::Arc;

use axum::{routing::get, Json, Router};
use config::HiveConfig;

/// Shared application state.
struct AppState {
    config: HiveConfig,
    #[allow(dead_code)]
    db: db::Database,
    start_time: std::time::Instant,
}

/// Health check response (BE-001).
#[derive(serde::Serialize)]
struct HealthResponse {
    status: &'static str,
    version: &'static str,
    uptime_secs: u64,
}

/// GET /api/health — returns server status, version, and uptime.
async fn health(state: axum::extract::State<Arc<AppState>>) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok",
        version: env!("CARGO_PKG_VERSION"),
        uptime_secs: state.start_time.elapsed().as_secs(),
    })
}

#[tokio::main]
async fn main() {
    // Logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "hive=info".parse().unwrap()),
        )
        .init();

    // Config
    let config_path = std::env::args()
        .nth(1)
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("hive.toml"));
    let config = config::load_config(&config_path);

    // Database
    let db_path = PathBuf::from(&config.server.data_dir).join("hive.db");
    if let Some(parent) = db_path.parent() {
        if let Err(e) = std::fs::create_dir_all(parent) {
            eprintln!(
                "[hive] error: cannot create data directory {}: {e}\n\
                 hint: set data_dir in hive.toml or HIVE_DATA_DIR env to a writable path",
                parent.display()
            );
            std::process::exit(1);
        }
    }
    let db = db::Database::open(&db_path).expect("failed to open database");
    tracing::info!("database opened at {}", db_path.display());

    let bind_addr = format!("{}:{}", config.server.host, config.server.port);
    tracing::info!("hive-server starting on {bind_addr}");

    let state = Arc::new(AppState {
        config,
        db,
        start_time: std::time::Instant::now(),
    });

    let app = Router::new()
        .route("/api/health", get(health))
        .route("/ws/{room_id}", get(ws_relay::ws_handler))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&bind_addr)
        .await
        .expect("failed to bind");

    tracing::info!("hive-server listening on {bind_addr}");
    axum::serve(listener, app).await.expect("server error");
}
