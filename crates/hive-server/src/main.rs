mod config;
pub mod error;

use std::path::PathBuf;
use std::sync::Arc;

use axum::{routing::get, Json, Router};
use config::HiveConfig;

/// Shared application state.
struct AppState {
    config: HiveConfig,
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

    let bind_addr = format!("{}:{}", config.server.host, config.server.port);
    tracing::info!("hive-server starting on {bind_addr}");

    let state = Arc::new(AppState {
        config,
        start_time: std::time::Instant::now(),
    });

    let app = Router::new()
        .route("/api/health", get(health))
        .with_state(state);

    let listener = tokio::net::TcpListener::bind(&bind_addr)
        .await
        .expect("failed to bind");

    tracing::info!("hive-server listening on {bind_addr}");
    axum::serve(listener, app).await.expect("server error");
}
