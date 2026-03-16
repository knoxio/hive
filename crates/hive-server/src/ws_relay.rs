//! WebSocket relay between frontend clients and the room daemon.
//!
//! Each frontend WS connection gets paired with an upstream WS connection to
//! the room daemon. Messages flow bidirectionally:
//!
//! ```text
//! Frontend ←→ Hive WS Relay ←→ Room Daemon
//! ```

use std::sync::Arc;

use axum::{
    extract::{
        ws::{Message, WebSocket},
        Path, State, WebSocketUpgrade,
    },
    response::IntoResponse,
};
use futures_util::{SinkExt, StreamExt};
use tokio_tungstenite::{connect_async, tungstenite::Message as TungsteniteMsg};

use crate::AppState;

/// GET /ws/:room_id — upgrade to WebSocket and relay to room daemon.
pub async fn ws_handler(
    ws: WebSocketUpgrade,
    Path(room_id): Path<String>,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let daemon_ws_url = format!(
        "ws://127.0.0.1:{}/ws/{}",
        state.config.daemon.ws_port, room_id
    );
    ws.on_upgrade(move |socket| relay(socket, daemon_ws_url))
}

/// Bidirectional relay between a frontend WebSocket and a room daemon WebSocket.
async fn relay(frontend_ws: WebSocket, daemon_url: String) {
    // Connect upstream to room daemon.
    let upstream = match connect_async(&daemon_url).await {
        Ok((ws, _)) => ws,
        Err(e) => {
            tracing::error!("failed to connect to room daemon at {daemon_url}: {e}");
            return;
        }
    };

    tracing::info!("relay established: frontend ↔ {daemon_url}");

    let (mut fe_tx, mut fe_rx) = frontend_ws.split();
    let (mut daemon_tx, mut daemon_rx) = upstream.split();

    // Forward frontend → daemon
    let fe_to_daemon = tokio::spawn(async move {
        while let Some(Ok(msg)) = fe_rx.next().await {
            match msg {
                Message::Text(text) => {
                    if daemon_tx
                        .send(TungsteniteMsg::Text(text.to_string().into()))
                        .await
                        .is_err()
                    {
                        break;
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    // Forward daemon → frontend
    let daemon_to_fe = tokio::spawn(async move {
        while let Some(Ok(msg)) = daemon_rx.next().await {
            match msg {
                TungsteniteMsg::Text(text) => {
                    if fe_tx
                        .send(Message::Text(text.to_string().into()))
                        .await
                        .is_err()
                    {
                        break;
                    }
                }
                TungsteniteMsg::Close(_) => break,
                _ => {}
            }
        }
    });

    // Wait for either direction to close, then abort the other.
    tokio::select! {
        _ = fe_to_daemon => {},
        _ = daemon_to_fe => {},
    }

    tracing::info!("relay closed: {daemon_url}");
}
