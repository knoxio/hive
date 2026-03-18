//! REST proxy — forwards API requests to the co-located room daemon.
//!
//! Implements BE-004 through BE-007: room list, room info, messages, send.
//! Forwards Authorization headers from the client to the daemon.

use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::AppState;

// ---------------------------------------------------------------------------
// History query parameters
// ---------------------------------------------------------------------------

/// Query parameters for `GET /api/rooms/:room_id/messages`.
#[derive(Debug, Deserialize)]
pub struct HistoryQuery {
    /// Return messages whose ID is strictly before this cursor (backward pagination).
    /// When absent, returns the most recent `limit` messages.
    pub before: Option<String>,
    /// Number of messages to return (default: 50, max: 200).
    pub limit: Option<u64>,
}

/// Response shape for `GET /api/rooms/:room_id/messages`.
#[derive(Debug, Serialize)]
pub struct MessagesResponse {
    pub messages: Vec<Value>,
    /// Whether older messages exist beyond the current page.
    pub has_more: bool,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Extract the daemon REST base URL from config.
fn daemon_base(state: &AppState) -> String {
    state
        .config
        .daemon
        .ws_url
        .replace("ws://", "http://")
        .replace("wss://", "https://")
}

/// Build a reqwest client with optional auth header forwarding.
fn build_request(
    client: &reqwest::Client,
    method: reqwest::Method,
    url: &str,
    headers: &HeaderMap,
) -> reqwest::RequestBuilder {
    let mut req = client.request(method, url);
    // Forward Authorization header to room daemon
    if let Some(auth) = headers.get("authorization") {
        if let Ok(val) = auth.to_str() {
            req = req.header("Authorization", val);
        }
    }
    req
}

/// Extract the `id` field from a message `Value` as a `&str`, if present.
fn msg_id(msg: &Value) -> Option<&str> {
    msg.get("id").and_then(Value::as_str)
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /api/rooms/:room_id — get room info.
pub async fn get_room(
    State(state): State<Arc<AppState>>,
    Path(room_id): Path<String>,
    headers: HeaderMap,
) -> Result<Json<Value>, StatusCode> {
    let base = daemon_base(&state);
    let url = format!("{base}/api/{room_id}/poll");

    let client = reqwest::Client::new();
    match build_request(&client, reqwest::Method::GET, &url, &headers)
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => Ok(Json(serde_json::json!({
            "id": room_id,
            "name": room_id,
            "status": "active"
        }))),
        Ok(resp) => Ok(Json(serde_json::json!({
            "id": room_id,
            "name": room_id,
            "status": "error",
            "daemon_status": resp.status().as_u16()
        }))),
        Err(_) => Ok(Json(serde_json::json!({
            "id": room_id,
            "name": room_id,
            "status": "daemon_unavailable"
        }))),
    }
}

/// `GET /api/rooms/:room_id/messages?before=<id>&limit=<n>` — paginated message history.
///
/// Fetches all available messages from the daemon, then slices them
/// server-side to implement cursor-based backward pagination:
///
/// - **No cursor** (`before` absent): returns the last `limit` messages.
/// - **With cursor** (`before=<id>`): returns the last `limit` messages
///   whose position is strictly before the message with the given ID.
///
/// Returns `{ messages: [...], has_more: bool }`.
pub async fn get_messages(
    State(state): State<Arc<AppState>>,
    Path(room_id): Path<String>,
    Query(query): Query<HistoryQuery>,
    headers: HeaderMap,
) -> Result<Json<MessagesResponse>, StatusCode> {
    let limit = query.limit.unwrap_or(50).min(200) as usize;
    let base = daemon_base(&state);
    let url = format!("{base}/api/{room_id}/poll");

    let client = reqwest::Client::new();
    let all_messages: Vec<Value> =
        match build_request(&client, reqwest::Method::GET, &url, &headers)
            .send()
            .await
        {
            Ok(resp) => {
                let body: Value = resp
                    .json()
                    .await
                    .unwrap_or(serde_json::json!({"messages": []}));
                body.get("messages")
                    .and_then(Value::as_array)
                    .cloned()
                    .unwrap_or_default()
            }
            Err(_) => vec![],
        };

    // Apply cursor: keep only messages that appear before the cursor ID.
    let messages_before: &[Value] = if let Some(before_id) = &query.before {
        if let Some(pos) = all_messages
            .iter()
            .position(|m| msg_id(m) == Some(before_id.as_str()))
        {
            &all_messages[..pos]
        } else {
            // Cursor not found — return nothing (client has stale cursor).
            &[]
        }
    } else {
        &all_messages
    };

    // Take the last `limit` messages from the slice.
    let start = messages_before.len().saturating_sub(limit);
    let page = messages_before[start..].to_vec();
    let has_more = start > 0;

    Ok(Json(MessagesResponse {
        messages: page,
        has_more,
    }))
}

/// Validate that the `content` field in a send-message body is a non-empty
/// string. Returns `Err(BAD_REQUEST)` if missing or empty so the proxy never
/// forwards invalid payloads to the daemon.
fn validate_send_body(body: &Value) -> Result<(), StatusCode> {
    match body.get("content").and_then(Value::as_str) {
        Some(s) if !s.is_empty() => Ok(()),
        _ => Err(StatusCode::BAD_REQUEST),
    }
}

/// POST /api/rooms/:room_id/send — send a message to a room.
pub async fn send_message(
    State(state): State<Arc<AppState>>,
    Path(room_id): Path<String>,
    headers: HeaderMap,
    Json(body): Json<Value>,
) -> Result<Json<Value>, StatusCode> {
    validate_send_body(&body)?;

    let base = daemon_base(&state);
    let url = format!("{base}/api/{room_id}/send");

    let client = reqwest::Client::new();
    match build_request(&client, reqwest::Method::POST, &url, &headers)
        .json(&body)
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            let result: Value = resp.json().await.unwrap_or_default();
            Ok(Json(result))
        }
        Ok(resp) => {
            let status = resp.status().as_u16();
            let _error: Value = resp.json().await.unwrap_or_default();
            Err(StatusCode::from_u16(status).unwrap_or(StatusCode::BAD_GATEWAY))
        }
        Err(_) => Err(StatusCode::BAD_GATEWAY),
    }
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn make_msg(id: &str) -> Value {
        json!({"id": id, "type": "message", "content": "hello", "user": "alice", "ts": "2026-01-01T00:00:00Z"})
    }

    /// Replicate the cursor-slice logic so we can unit-test it independently.
    fn paginate(all: &[Value], before: Option<&str>, limit: usize) -> (Vec<Value>, bool) {
        let slice: &[Value] = if let Some(before_id) = before {
            if let Some(pos) = all.iter().position(|m| msg_id(m) == Some(before_id)) {
                &all[..pos]
            } else {
                &[]
            }
        } else {
            all
        };
        let start = slice.len().saturating_sub(limit);
        (slice[start..].to_vec(), start > 0)
    }

    #[test]
    fn no_cursor_returns_last_n() {
        let msgs: Vec<Value> = (0..10).map(|i| make_msg(&i.to_string())).collect();
        let (page, has_more) = paginate(&msgs, None, 5);
        assert_eq!(page.len(), 5);
        assert!(has_more);
        assert_eq!(msg_id(&page[0]), Some("5"));
        assert_eq!(msg_id(&page[4]), Some("9"));
    }

    #[test]
    fn no_cursor_fewer_than_limit_returns_all() {
        let msgs: Vec<Value> = (0..3).map(|i| make_msg(&i.to_string())).collect();
        let (page, has_more) = paginate(&msgs, None, 50);
        assert_eq!(page.len(), 3);
        assert!(!has_more);
    }

    #[test]
    fn cursor_slices_before_id() {
        let msgs: Vec<Value> = (0..10).map(|i| make_msg(&i.to_string())).collect();
        let (page, has_more) = paginate(&msgs, Some("5"), 3);
        // Messages before "5" are "0".."4"; last 3 = "2","3","4"
        assert_eq!(page.len(), 3);
        assert_eq!(msg_id(&page[0]), Some("2"));
        assert_eq!(msg_id(&page[2]), Some("4"));
        assert!(has_more);
    }

    #[test]
    fn cursor_at_first_message_returns_empty() {
        let msgs: Vec<Value> = (0..5).map(|i| make_msg(&i.to_string())).collect();
        let (page, has_more) = paginate(&msgs, Some("0"), 50);
        assert!(page.is_empty());
        assert!(!has_more);
    }

    #[test]
    fn cursor_not_found_returns_empty() {
        let msgs: Vec<Value> = (0..5).map(|i| make_msg(&i.to_string())).collect();
        let (page, has_more) = paginate(&msgs, Some("nonexistent"), 50);
        assert!(page.is_empty());
        assert!(!has_more);
    }

    #[test]
    fn limit_capped_at_200() {
        let msgs: Vec<Value> = (0..250u32).map(|i| make_msg(&i.to_string())).collect();
        let limit = 201_u64.min(200) as usize;
        let (page, _) = paginate(&msgs, None, limit);
        assert_eq!(page.len(), 200);
    }

    #[test]
    fn empty_room_returns_empty_no_more() {
        let (page, has_more) = paginate(&[], None, 50);
        assert!(page.is_empty());
        assert!(!has_more);
    }

    #[test]
    fn has_more_false_when_fits_in_limit() {
        let msgs: Vec<Value> = (0..5).map(|i| make_msg(&i.to_string())).collect();
        let (page, has_more) = paginate(&msgs, None, 50);
        assert_eq!(page.len(), 5);
        assert!(!has_more);
    }

    // -----------------------------------------------------------------------
    // validate_send_body tests (MH-021)
    // -----------------------------------------------------------------------

    #[test]
    fn send_body_valid_content_accepted() {
        assert!(validate_send_body(&json!({"content": "hello"})).is_ok());
    }

    #[test]
    fn send_body_unicode_content_accepted() {
        assert!(validate_send_body(&json!({"content": "日本語 🎉"})).is_ok());
    }

    #[test]
    fn send_body_missing_content_rejected() {
        assert_eq!(
            validate_send_body(&json!({})),
            Err(StatusCode::BAD_REQUEST)
        );
    }

    #[test]
    fn send_body_empty_content_rejected() {
        assert_eq!(
            validate_send_body(&json!({"content": ""})),
            Err(StatusCode::BAD_REQUEST)
        );
    }

    #[test]
    fn send_body_non_string_content_rejected() {
        assert_eq!(
            validate_send_body(&json!({"content": 42})),
            Err(StatusCode::BAD_REQUEST)
        );
        assert_eq!(
            validate_send_body(&json!({"content": null})),
            Err(StatusCode::BAD_REQUEST)
        );
    }

    #[test]
    fn send_body_extra_fields_do_not_affect_validation() {
        assert!(validate_send_body(&json!({"content": "hi", "room_id": "test", "user": "alice"})).is_ok());
    }
}
