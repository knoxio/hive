//! Current-user profile endpoint (MH-011).
//!
//! `GET /api/users/me` returns the authenticated user's identity from the
//! JWT claims injected by [`crate::auth::auth_middleware`].  No database
//! query is needed — all fields were validated at token-issuance time.

use axum::{Extension, Json};
use serde::Serialize;

use crate::auth::Claims;

/// Response body for `GET /api/users/me`.
#[derive(Debug, Serialize)]
pub struct MeResponse {
    /// Local user ID (stringified integer from `local_users.id`).
    pub id: String,
    /// Login username.
    pub username: String,
    /// User role: `"admin"` or `"user"`.
    pub role: String,
}

/// `GET /api/users/me` — returns the current user's identity.
///
/// Claims are injected by [`crate::auth::auth_middleware`] into Axum request
/// extensions before reaching this handler.  The response never touches the
/// database.
pub(crate) async fn me(Extension(claims): Extension<Claims>) -> Json<MeResponse> {
    Json(MeResponse {
        id: claims.sub,
        username: claims.username,
        role: claims.role,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::Claims;

    fn make_claims(username: &str, role: &str) -> Claims {
        Claims {
            sub: "42".into(),
            username: username.into(),
            role: role.into(),
            jti: uuid::Uuid::new_v4().to_string(),
            iat: 0,
            exp: u64::MAX,
        }
    }

    #[tokio::test]
    async fn me_returns_all_fields() {
        let claims = make_claims("alice", "admin");
        let Json(resp) = me(Extension(claims)).await;
        assert_eq!(resp.id, "42");
        assert_eq!(resp.username, "alice");
        assert_eq!(resp.role, "admin");
    }

    #[tokio::test]
    async fn me_user_role() {
        let claims = make_claims("bob", "user");
        let Json(resp) = me(Extension(claims)).await;
        assert_eq!(resp.role, "user");
        assert_eq!(resp.username, "bob");
    }

    #[tokio::test]
    async fn me_preserves_sub() {
        let mut claims = make_claims("carol", "user");
        claims.sub = "99".into();
        let Json(resp) = me(Extension(claims)).await;
        assert_eq!(resp.id, "99");
    }

    #[tokio::test]
    async fn me_response_serializes() {
        let claims = make_claims("dave", "admin");
        let Json(resp) = me(Extension(claims)).await;
        let json = serde_json::to_value(&resp).unwrap();
        assert!(json.get("id").is_some(), "must include id");
        assert!(json.get("username").is_some(), "must include username");
        assert!(json.get("role").is_some(), "must include role");
    }

    #[tokio::test]
    async fn me_username_empty_still_works() {
        // Edge case: claims with empty username (shouldn't happen in practice
        // but the handler should not panic on unexpected input).
        let claims = make_claims("", "user");
        let Json(resp) = me(Extension(claims)).await;
        assert_eq!(resp.username, "");
    }
}
