//! REST proxy — forwards API requests to the co-located room daemon.
//!
//! Implements BE-004 through BE-007: room list, room info, messages, send.

use std::sync::Arc;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde_json::Value;

use crate::AppState;

/// GET /api/rooms — list available rooms from the daemon.
pub async fn list_rooms(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Value>, StatusCode> {
    let daemon_url = &state.config.daemon.ws_url;
    let base = daemon_url.replace("ws://", "http://").replace("wss://", "https://");
    let url = format!("{base}/api/health");

    // Room daemon doesn't have a "list rooms" REST endpoint by default.
    // Return discovered rooms from daemon health or a placeholder.
    let client = reqwest::Client::new();
    match client.get(&url).send().await {
        Ok(resp) => {
            let body: Value = resp.json().await.unwrap_or_default();
            // Extract room info from health response if available
            let room = body.get("room").and_then(|r| r.as_str()).unwrap_or("default");
            Ok(Json(serde_json::json!({
                "rooms": [{ "id": room, "name": room }]
            })))
        }
        Err(_) => Ok(Json(serde_json::json!({
            "rooms": [],
            "error": "daemon unavailable"
        }))),
    }
}

/// GET /api/rooms/:room_id — get room info.
pub async fn get_room(
    State(state): State<Arc<AppState>>,
    Path(room_id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let daemon_url = &state.config.daemon.ws_url;
    let base = daemon_url.replace("ws://", "http://").replace("wss://", "https://");
    let url = format!("{base}/api/{room_id}/poll");

    let client = reqwest::Client::new();
    match client.get(&url).send().await {
        Ok(resp) if resp.status().is_success() => {
            Ok(Json(serde_json::json!({
                "id": room_id,
                "name": room_id,
                "status": "active"
            })))
        }
        _ => Ok(Json(serde_json::json!({
            "id": room_id,
            "name": room_id,
            "status": "unknown"
        }))),
    }
}

/// GET /api/rooms/:room_id/messages — poll messages from a room.
pub async fn get_messages(
    State(state): State<Arc<AppState>>,
    Path(room_id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let daemon_url = &state.config.daemon.ws_url;
    let base = daemon_url.replace("ws://", "http://").replace("wss://", "https://");
    let url = format!("{base}/api/{room_id}/poll");

    let client = reqwest::Client::new();
    match client.get(&url).send().await {
        Ok(resp) => {
            let body: Value = resp.json().await.unwrap_or(serde_json::json!({"messages": []}));
            Ok(Json(body))
        }
        Err(e) => Ok(Json(serde_json::json!({
            "messages": [],
            "error": format!("daemon unavailable: {e}")
        }))),
    }
}

/// POST /api/rooms/:room_id/send — send a message to a room.
pub async fn send_message(
    State(state): State<Arc<AppState>>,
    Path(room_id): Path<String>,
    Json(body): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    let daemon_url = &state.config.daemon.ws_url;
    let base = daemon_url.replace("ws://", "http://").replace("wss://", "https://");
    let url = format!("{base}/api/{room_id}/send");

    let client = reqwest::Client::new();
    match client.post(&url).json(&body).send().await {
        Ok(resp) => {
            let result: Value = resp.json().await.unwrap_or_default();
            Ok(Json(result))
        }
        Err(_) => Err(StatusCode::BAD_GATEWAY),
    }
}
