//! Agent list endpoint — MH-025.
//!
//! `GET /api/agents` returns the list of users registered in the room daemon.
//! Health is reported as `healthy` for any user present in the daemon registry.
//! Fields not tracked by the daemon (model, personality, pid) are returned as
//! empty/zero defaults; callers should treat them as informational only.

use std::sync::Arc;

use axum::{extract::State, Json};
use serde::Serialize;
use serde_json::Value;

use crate::AppState;

/// A single agent entry returned by `GET /api/agents`.
#[derive(Debug, Serialize)]
pub struct AgentInfo {
    pub username: String,
    pub health: &'static str,
    pub model: String,
    pub personality: String,
    pub pid: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uptime: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub spawned_at: Option<String>,
}

/// Response envelope for `GET /api/agents`.
#[derive(Debug, Serialize)]
pub struct AgentsResponse {
    pub agents: Vec<AgentInfo>,
}

/// Extract the daemon REST base URL from config.
fn daemon_base(state: &AppState) -> String {
    state
        .config
        .daemon
        .ws_url
        .replace("ws://", "http://")
        .replace("wss://", "https://")
}

/// GET /api/agents — list all users registered in the room daemon.
///
/// Queries the daemon's `GET /api/users` endpoint and maps each username to an
/// `AgentInfo`. If the daemon is unreachable the endpoint returns an empty list
/// (graceful degradation — the frontend already handles this case).
pub async fn list_agents(State(state): State<Arc<AppState>>) -> Json<AgentsResponse> {
    let base = daemon_base(&state);
    let url = format!("{base}/api/users");

    let agents = match reqwest::Client::new()
        .get(&url)
        .timeout(std::time::Duration::from_secs(5))
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => match resp.json::<Value>().await {
            Ok(body) => {
                let usernames = body
                    .get("users")
                    .and_then(Value::as_array)
                    .cloned()
                    .unwrap_or_default();
                usernames
                    .into_iter()
                    .filter_map(|v| v.as_str().map(str::to_owned))
                    .map(|username| AgentInfo {
                        username,
                        health: "healthy",
                        model: String::new(),
                        personality: String::new(),
                        pid: 0,
                        status: None,
                        uptime: None,
                        spawned_at: None,
                    })
                    .collect()
            }
            Err(_) => vec![],
        },
        _ => vec![],
    };

    Json(AgentsResponse { agents })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_agent(username: &str) -> AgentInfo {
        AgentInfo {
            username: username.to_owned(),
            health: "healthy",
            model: String::new(),
            personality: String::new(),
            pid: 0,
            status: None,
            uptime: None,
            spawned_at: None,
        }
    }

    #[test]
    fn agent_info_serializes_username_and_health() {
        let agent = make_agent("alice");
        let json = serde_json::to_value(&agent).unwrap();
        assert_eq!(json["username"], "alice");
        assert_eq!(json["health"], "healthy");
    }

    #[test]
    fn agent_info_serializes_model_and_personality() {
        let agent = make_agent("bob");
        let json = serde_json::to_value(&agent).unwrap();
        assert_eq!(json["model"], "");
        assert_eq!(json["personality"], "");
    }

    #[test]
    fn agent_info_serializes_pid_zero() {
        let agent = make_agent("carol");
        let json = serde_json::to_value(&agent).unwrap();
        assert_eq!(json["pid"], 0);
    }

    #[test]
    fn agent_info_omits_optional_fields_when_none() {
        let agent = make_agent("dave");
        let json = serde_json::to_value(&agent).unwrap();
        assert!(json.get("status").is_none());
        assert!(json.get("uptime").is_none());
        assert!(json.get("spawned_at").is_none());
    }

    #[test]
    fn agent_info_includes_optional_status_when_set() {
        let agent = AgentInfo {
            username: "eve".to_owned(),
            health: "healthy",
            model: String::new(),
            personality: String::new(),
            pid: 0,
            status: Some("working on PR #42".to_owned()),
            uptime: None,
            spawned_at: None,
        };
        let json = serde_json::to_value(&agent).unwrap();
        assert_eq!(json["status"], "working on PR #42");
    }

    #[test]
    fn agents_response_wraps_list() {
        let resp = AgentsResponse {
            agents: vec![make_agent("alice"), make_agent("bob")],
        };
        let json = serde_json::to_value(&resp).unwrap();
        let arr = json["agents"].as_array().unwrap();
        assert_eq!(arr.len(), 2);
        assert_eq!(arr[0]["username"], "alice");
        assert_eq!(arr[1]["username"], "bob");
    }

    #[test]
    fn agents_response_empty_list() {
        let resp = AgentsResponse { agents: vec![] };
        let json = serde_json::to_value(&resp).unwrap();
        assert_eq!(json["agents"].as_array().unwrap().len(), 0);
    }
}
