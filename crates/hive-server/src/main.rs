pub mod admin;
pub mod auth;
mod config;
pub mod daemon;
pub mod db;
pub mod error;
pub mod preferences;
mod rest_proxy;
pub mod rooms;
pub mod settings;
pub mod users;
mod ws_relay;

use std::path::PathBuf;
use std::sync::Arc;

use axum::{
    middleware,
    routing::{get, post},
    Json, Router,
};
use config::HiveConfig;
use tower_http::cors::{Any, CorsLayer};

/// Shared application state.
pub struct AppState {
    pub(crate) config: HiveConfig,
    pub(crate) db: db::Database,
    pub(crate) jwt_secret: Vec<u8>,
    pub(crate) jwt_ttl: u64,
    start_time: std::time::Instant,
}

/// Health check response (BE-001).
#[derive(serde::Serialize)]
struct HealthResponse {
    status: &'static str,
    version: &'static str,
    uptime_secs: u64,
    daemon_connected: bool,
    daemon_url: String,
}

/// GET /api/health — returns server status, version, uptime, and daemon connection.
async fn health(state: axum::extract::State<Arc<AppState>>) -> Json<HealthResponse> {
    let daemon_url = state.config.daemon.ws_url.clone();
    let base = daemon_url
        .replace("ws://", "http://")
        .replace("wss://", "https://");
    let daemon_connected = reqwest::Client::new()
        .get(format!("{base}/api/health"))
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await
        .is_ok();

    let status = if daemon_connected { "ok" } else { "degraded" };

    Json(HealthResponse {
        status,
        version: env!("CARGO_PKG_VERSION"),
        uptime_secs: state.start_time.elapsed().as_secs(),
        daemon_connected,
        daemon_url,
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

    // JWT secret — must be set and ≥ 32 bytes before anything else starts.
    let jwt_secret = auth::load_jwt_secret();
    let jwt_ttl = auth::jwt_ttl_secs();

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

    // Seed default settings (no-op if already seeded).
    let daemon_url = settings::resolve_daemon_url(&config.daemon.ws_url);
    settings::seed_defaults(&db, &daemon_url);

    // Seed admin user from env vars (idempotent).
    auth::seed_admin_user(&db);

    let bind_addr = format!("{}:{}", config.server.host, config.server.port);
    tracing::info!("hive-server starting on {bind_addr}");

    let state = Arc::new(AppState {
        config,
        db,
        jwt_secret,
        jwt_ttl,
        start_time: std::time::Instant::now(),
    });

    // Public routes — no auth required.
    let public_routes = Router::new()
        .route("/api/health", get(health))
        .route("/api/auth/login", post(auth::login));

    // Protected routes — require valid Bearer JWT.
    let protected_routes = Router::new()
        .route("/api/auth/me", get(auth::me))
        .route("/api/users/me", get(users::me))
        .route(
            "/api/users/me/preferences",
            get(preferences::get_preferences).patch(preferences::patch_preferences),
        )
        .route("/api/auth/logout", post(auth::logout))
        .route(
            "/api/admin/users",
            get(admin::list_users).post(admin::create_user),
        )
        .route(
            "/api/admin/users/{id}",
            axum::routing::patch(admin::patch_user).delete(admin::delete_user),
        )
        .route(
            "/api/rooms",
            get(rooms::list_rooms).post(rooms::create_room),
        )
        .route("/api/rooms/{room_id}", get(rest_proxy::get_room))
        .route(
            "/api/rooms/{room_id}/messages",
            get(rest_proxy::get_messages),
        )
        .route("/api/rooms/{room_id}/send", post(rest_proxy::send_message))
        .route(
            "/api/settings",
            get(settings::get_settings).patch(settings::patch_settings),
        )
        .route("/api/settings/history", get(settings::get_settings_history))
        .route("/ws/{room_id}", get(ws_relay::ws_handler))
        .layer(middleware::from_fn_with_state(
            Arc::clone(&state),
            auth::auth_middleware,
        ));

    let app = Router::new()
        .merge(public_routes)
        .merge(protected_routes)
        .with_state(state)
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        );

    let listener = tokio::net::TcpListener::bind(&bind_addr)
        .await
        .expect("failed to bind");

    tracing::info!("hive-server listening on {bind_addr}");
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .expect("server error");

    tracing::info!("hive-server shutting down gracefully");
}

/// Wait for SIGTERM or SIGINT (Ctrl+C) to initiate graceful shutdown.
async fn shutdown_signal() {
    let ctrl_c = async {
        tokio::signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => tracing::info!("received SIGINT, initiating shutdown"),
        _ = terminate => tracing::info!("received SIGTERM, initiating shutdown"),
    }
}
