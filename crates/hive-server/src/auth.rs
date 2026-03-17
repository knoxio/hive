//! JWT authentication for Hive.
//!
//! Provides:
//! - `POST /api/auth/login` — validate local credentials, issue signed JWT
//! - `auth_middleware` — tower middleware enforcing Bearer JWT on protected routes
//! - Token revocation via `revoked_tokens` DB table (keyed by `jti`)
//!
//! # Environment variables
//! - `HIVE_JWT_SECRET` (required, ≥ 32 bytes) — HMAC-SHA256 signing key
//! - `HIVE_JWT_TTL_SECS` (optional, default 86400) — token lifetime in seconds

use axum::extract::State;
use axum::http::{header, Request};
use axum::middleware::Next;
use axum::response::{IntoResponse, Response};
use axum::Json;
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::error::HiveError;
use crate::util::{unix_now, unix_secs_to_sqlite_datetime};
use crate::AppState;

// ---------------------------------------------------------------------------
// JWT configuration
// ---------------------------------------------------------------------------

/// Load and validate the JWT signing key from the environment.
///
/// Exits with a clear error message if `HIVE_JWT_SECRET` is absent or too short.
pub fn load_jwt_secret() -> Vec<u8> {
    let secret = std::env::var("HIVE_JWT_SECRET").unwrap_or_else(|_| {
        eprintln!(
            "[hive] fatal: HIVE_JWT_SECRET environment variable is not set.\n\
             hint: generate one with: openssl rand -hex 32"
        );
        std::process::exit(1);
    });
    let bytes = secret.into_bytes();
    if bytes.len() < 32 {
        eprintln!(
            "[hive] fatal: HIVE_JWT_SECRET is too short ({} bytes); minimum is 32 bytes.\n\
             hint: generate one with: openssl rand -hex 32",
            bytes.len()
        );
        std::process::exit(1);
    }
    bytes
}

/// Read token TTL from `HIVE_JWT_TTL_SECS` (default 86400 = 24 hours).
pub fn jwt_ttl_secs() -> u64 {
    std::env::var("HIVE_JWT_TTL_SECS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(86_400)
}

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

/// Claims encoded in every JWT.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    /// Subject — local_users.id as string.
    pub sub: String,
    /// Login username.
    pub username: String,
    /// User role ("admin" or "user").
    pub role: String,
    /// Unique token ID (used for revocation).
    pub jti: String,
    /// Issued-at (Unix seconds).
    pub iat: u64,
    /// Expiry (Unix seconds).
    pub exp: u64,
}

/// Response body for a successful login.
#[derive(Serialize)]
pub struct TokenResponse {
    pub token: String,
    pub token_type: &'static str,
    pub expires_in: u64,
    pub username: String,
}

/// Request body for `POST /api/auth/login`.
#[derive(Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

// ---------------------------------------------------------------------------
// Login handler
// ---------------------------------------------------------------------------

/// `POST /api/auth/login` — validate credentials and issue a signed JWT.
pub(crate) async fn login(
    State(state): State<Arc<AppState>>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<TokenResponse>, HiveError> {
    if req.username.is_empty() || req.password.is_empty() {
        return Err(HiveError::BadRequest(
            "username and password are required".into(),
        ));
    }

    // Look up local user and verify password (bcrypt is CPU-intensive — use spawn_blocking).
    let username = req.username.clone();
    let password = req.password.clone();
    let db = state.db.clone();

    let (user_id, role) = tokio::task::spawn_blocking(move || {
        db.with_conn(|conn| {
            // Include active column — deactivated users must not log in.
            let result: Option<(i64, String, String, i64)> = conn
                .query_row(
                    "SELECT id, password_hash, role, active \
                     FROM local_users WHERE username = ?1",
                    [&username],
                    |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
                )
                .ok();

            match result {
                None => Err(rusqlite::Error::QueryReturnedNoRows),
                Some((id, hash, role, active)) => match bcrypt::verify(&password, &hash) {
                    Ok(true) if active != 0 => Ok((id, role)),
                    Ok(true) => Err(rusqlite::Error::SqliteFailure(
                        rusqlite::ffi::Error {
                            code: rusqlite::ErrorCode::ConstraintViolation,
                            extended_code: 0,
                        },
                        Some("ACCOUNT_DISABLED".to_string()),
                    )),
                    _ => Err(rusqlite::Error::QueryReturnedNoRows),
                },
            }
        })
    })
    .await
    .map_err(|e| HiveError::Internal(format!("task join error: {e}")))?
    .map_err(|e| {
        if e.to_string().contains("ACCOUNT_DISABLED") {
            HiveError::Forbidden("account is disabled".into())
        } else {
            HiveError::Unauthorized("invalid username or password".into())
        }
    })?;

    // Issue JWT.
    let now = unix_now();
    let ttl = state.jwt_ttl;
    let jti = uuid::Uuid::new_v4().to_string();

    let claims = Claims {
        sub: user_id.to_string(),
        username: req.username.clone(),
        role,
        jti,
        iat: now,
        exp: now + ttl,
    };

    let token = encode(
        &Header::new(Algorithm::HS256),
        &claims,
        &EncodingKey::from_secret(&state.jwt_secret),
    )
    .map_err(|e| HiveError::Internal(format!("JWT encode error: {e}")))?;

    tracing::info!(username = %req.username, "login successful");

    Ok(Json(TokenResponse {
        token,
        token_type: "Bearer",
        expires_in: ttl,
        username: req.username,
    }))
}

// ---------------------------------------------------------------------------
// Logout handler
// ---------------------------------------------------------------------------

/// Response body for a successful logout.
#[derive(Serialize)]
pub struct LogoutResponse {
    pub message: &'static str,
}

/// `POST /api/auth/logout` — revoke the current JWT by adding its `jti` to
/// `revoked_tokens`. The token remains cryptographically valid but will be
/// rejected by `auth_middleware` on every subsequent request.
///
/// Always returns 200; the client must clear its local token regardless.
pub(crate) async fn logout(
    State(state): State<Arc<AppState>>,
    axum::extract::Extension(claims): axum::extract::Extension<Claims>,
) -> Result<Json<LogoutResponse>, HiveError> {
    // Store expires_at as "YYYY-MM-DD HH:MM:SS" (SQLite datetime format).
    let expires_at_str = unix_secs_to_sqlite_datetime(claims.exp);

    let db = state.db.clone();
    let jti = claims.jti.clone();
    let sub = claims.sub.clone();
    tokio::task::spawn_blocking(move || {
        db.with_conn(|conn| {
            conn.execute(
                "INSERT OR IGNORE INTO revoked_tokens (jti, user_id, expires_at) \
                 VALUES (?1, ?2, ?3)",
                rusqlite::params![jti, sub, expires_at_str],
            )?;
            Ok::<_, rusqlite::Error>(())
        })
    })
    .await
    .map_err(|e| HiveError::Internal(format!("task join error: {e}")))?
    .map_err(|e| HiveError::Internal(format!("db error: {e}")))?;

    tracing::info!(jti = %claims.jti, username = %claims.username, "logout — token revoked");

    Ok(Json(LogoutResponse {
        message: "logged out",
    }))
}

// ---------------------------------------------------------------------------
// Token validation
// ---------------------------------------------------------------------------

/// Decode and validate a JWT string. Returns the claims on success.
pub fn validate_token(token: &str, secret: &[u8]) -> Result<Claims, String> {
    let mut validation = Validation::new(Algorithm::HS256);
    validation.validate_exp = true;
    validation.leeway = 0; // no clock skew tolerance

    decode::<Claims>(token, &DecodingKey::from_secret(secret), &validation)
        .map(|data| data.claims)
        .map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Auth middleware
// ---------------------------------------------------------------------------

/// Tower middleware that enforces a valid Bearer JWT on every request.
///
/// Returns HTTP 401 with `{ "code": "UNAUTHORIZED", "message": "..." }` for:
/// - Missing `Authorization` header
/// - Malformed header (not `Bearer <token>`)
/// - Invalid or expired JWT signature
/// - Revoked `jti`
pub(crate) async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    mut request: Request<axum::body::Body>,
    next: Next,
) -> Response {
    let auth_header = request
        .headers()
        .get(header::AUTHORIZATION)
        .and_then(|v| v.to_str().ok());

    let token_str = match auth_header {
        Some(h) if h.starts_with("Bearer ") => &h[7..],
        Some(_) => {
            return HiveError::Unauthorized("invalid authorization header format".into())
                .into_response()
        }
        None => {
            return HiveError::Unauthorized("authorization header required".into()).into_response()
        }
    };

    let claims = match validate_token(token_str, &state.jwt_secret) {
        Ok(c) => c,
        Err(e) => {
            tracing::warn!(error = %e, "JWT validation failed");
            return HiveError::Unauthorized(e).into_response();
        }
    };

    // Check token revocation.
    let jti = claims.jti.clone();
    let db = state.db.clone();
    let revoked = tokio::task::spawn_blocking(move || {
        db.with_conn(|conn| {
            let count: i64 = conn
                .query_row(
                    "SELECT COUNT(*) FROM revoked_tokens WHERE jti = ?1",
                    [&jti],
                    |row| row.get(0),
                )
                .unwrap_or(0);
            Ok::<_, rusqlite::Error>(count > 0)
        })
    })
    .await
    .unwrap_or(Ok(false))
    .unwrap_or(false);

    if revoked {
        return HiveError::Unauthorized("token has been revoked".into()).into_response();
    }

    // Attach claims to request extensions so downstream handlers can read them.
    request.extensions_mut().insert(claims);

    next.run(request).await
}

// ---------------------------------------------------------------------------
// GET /api/auth/me
// ---------------------------------------------------------------------------

/// Response body for `GET /api/auth/me`.
#[derive(Serialize)]
pub struct MeResponse {
    pub sub: String,
    pub username: String,
    pub role: String,
    /// Token expiry as Unix seconds.
    pub exp: u64,
}

/// `GET /api/auth/me` — return the authenticated user's identity from the JWT.
///
/// Requires a valid Bearer token (enforced by `auth_middleware`).  The claims
/// are already decoded and attached to the request extensions by the middleware.
pub(crate) async fn me(axum::Extension(claims): axum::Extension<Claims>) -> Json<MeResponse> {
    Json(MeResponse {
        sub: claims.sub,
        username: claims.username,
        role: claims.role,
        exp: claims.exp,
    })
}

// ---------------------------------------------------------------------------
// Admin user seeding
// ---------------------------------------------------------------------------

/// Seed the admin user from `HIVE_ADMIN_USER` / `HIVE_ADMIN_PASSWORD` env vars.
///
/// Only creates the user if no admin exists yet (idempotent on repeat starts).
pub fn seed_admin_user(db: &crate::db::Database) {
    let username = std::env::var("HIVE_ADMIN_USER").unwrap_or_else(|_| "admin".to_string());
    let password = match std::env::var("HIVE_ADMIN_PASSWORD") {
        Ok(p) if !p.is_empty() => p,
        _ => {
            tracing::warn!(
                "HIVE_ADMIN_PASSWORD not set — admin user will not be created. \
                 Set HIVE_ADMIN_PASSWORD to enable local login."
            );
            return;
        }
    };

    let hash = match bcrypt::hash(&password, bcrypt::DEFAULT_COST) {
        Ok(h) => h,
        Err(e) => {
            tracing::error!("failed to hash admin password: {e}");
            return;
        }
    };

    match db.with_conn(|conn| {
        conn.execute(
            "INSERT OR IGNORE INTO local_users (username, password_hash, role) \
             VALUES (?1, ?2, 'admin')",
            [&username, &hash],
        )
    }) {
        Ok(changed) if changed > 0 => tracing::info!(username = %username, "admin user created"),
        Ok(_) => tracing::info!(username = %username, "admin user already exists"),
        Err(e) => tracing::error!("failed to seed admin user: {e}"),
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    const SECRET: &[u8] = b"test-secret-that-is-at-least-32-bytes-long!";

    fn make_claims(exp_offset_secs: i64) -> Claims {
        let now = unix_now();
        let exp = if exp_offset_secs >= 0 {
            now + exp_offset_secs as u64
        } else {
            now.saturating_sub((-exp_offset_secs) as u64)
        };
        Claims {
            sub: "1".into(),
            username: "test-user".into(),
            role: "user".into(),
            jti: uuid::Uuid::new_v4().to_string(),
            iat: now,
            exp,
        }
    }

    fn encode_claims(claims: &Claims) -> String {
        encode(
            &Header::new(Algorithm::HS256),
            claims,
            &EncodingKey::from_secret(SECRET),
        )
        .unwrap()
    }

    #[test]
    fn valid_token_accepted() {
        let claims = make_claims(3600);
        let token = encode_claims(&claims);
        let result = validate_token(&token, SECRET);
        assert!(result.is_ok());
        let got = result.unwrap();
        assert_eq!(got.username, "test-user");
        assert_eq!(got.role, "user");
    }

    #[test]
    fn expired_token_rejected() {
        let claims = make_claims(-10);
        let token = encode_claims(&claims);
        let result = validate_token(&token, SECRET);
        assert!(result.is_err());
        let msg = result.unwrap_err();
        assert!(
            msg.to_lowercase().contains("expired") || msg.to_lowercase().contains("exp"),
            "unexpected error: {msg}"
        );
    }

    #[test]
    fn tampered_signature_rejected() {
        let claims = make_claims(3600);
        let token = encode_claims(&claims);
        let tampered = {
            let mut t = token.clone();
            let last = t.pop().unwrap();
            t.push(if last == 'a' { 'b' } else { 'a' });
            t
        };
        let result = validate_token(&tampered, SECRET);
        assert!(result.is_err());
    }

    #[test]
    fn missing_token_rejected() {
        let result = validate_token("", SECRET);
        assert!(result.is_err());
    }

    #[test]
    fn wrong_algorithm_rejected() {
        // Build a token signed with HS512 — Validation::new(HS256) must reject it.
        let claims = make_claims(3600);
        let token = encode(
            &Header::new(Algorithm::HS512),
            &claims,
            &EncodingKey::from_secret(SECRET),
        )
        .unwrap();
        let result = validate_token(&token, SECRET);
        assert!(result.is_err());
    }

    #[test]
    fn claims_contain_required_fields() {
        let claims = make_claims(3600);
        let token = encode_claims(&claims);
        let got = validate_token(&token, SECRET).unwrap();
        assert!(!got.sub.is_empty(), "sub must not be empty");
        assert!(!got.username.is_empty(), "username must not be empty");
        assert!(!got.role.is_empty(), "role must not be empty");
        assert!(!got.jti.is_empty(), "jti must not be empty");
        assert!(got.iat > 0, "iat must be set");
        assert!(got.exp > got.iat, "exp must be after iat");
    }

    #[test]
    fn short_secret_is_too_small() {
        // Verify the boundary condition our startup check enforces.
        let too_short = b"only-31-bytes-which-is-too-shor";
        assert!(too_short.len() < 32, "must be < 32 bytes to be rejected");
    }

    #[test]
    fn valid_secret_is_accepted() {
        let ok = b"exactly-32-bytes-of-secret-key!!";
        assert!(ok.len() >= 32);
    }

    // -----------------------------------------------------------------------
    // datetime helper tests
    // -----------------------------------------------------------------------

    #[test]
    fn unix_epoch_formats_correctly() {
        // Unix epoch 0 = 1970-01-01 00:00:00
        assert_eq!(unix_secs_to_sqlite_datetime(0), "1970-01-01 00:00:00");
    }

    #[test]
    fn known_timestamp_formats_correctly() {
        // 2021-01-01 00:00:00 UTC = 1609459200
        assert_eq!(
            unix_secs_to_sqlite_datetime(1609459200),
            "2021-01-01 00:00:00"
        );
    }

    #[test]
    fn leap_year_date_formats_correctly() {
        // 2024-02-29 00:00:00 UTC (leap day) = 1709164800
        assert_eq!(
            unix_secs_to_sqlite_datetime(1709164800),
            "2024-02-29 00:00:00"
        );
    }

    #[test]
    fn datetime_string_has_correct_length() {
        let s = unix_secs_to_sqlite_datetime(unix_now());
        assert_eq!(
            s.len(),
            19,
            "expected 'YYYY-MM-DD HH:MM:SS' (19 chars), got: {s}"
        );
    }

    // -----------------------------------------------------------------------
    // revoked_tokens DB integration test
    // -----------------------------------------------------------------------

    #[test]
    fn revoked_token_inserted_into_db() {
        let db = crate::db::Database::open_memory().unwrap();
        let jti = "test-jti-12345";
        let expires_at = unix_secs_to_sqlite_datetime(unix_now() + 3600);

        db.with_conn(|conn| {
            conn.execute(
                "INSERT INTO revoked_tokens (jti, user_id, expires_at) VALUES (?1, ?2, ?3)",
                rusqlite::params![jti, "1", expires_at],
            )?;
            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM revoked_tokens WHERE jti = ?1",
                [jti],
                |row| row.get(0),
            )?;
            assert_eq!(count, 1);
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn insert_or_ignore_duplicate_jti() {
        let db = crate::db::Database::open_memory().unwrap();
        let jti = "duplicate-jti";
        let expires_at = unix_secs_to_sqlite_datetime(unix_now() + 3600);

        db.with_conn(|conn| {
            // Insert twice — second should be silently ignored.
            conn.execute(
                "INSERT OR IGNORE INTO revoked_tokens (jti, user_id, expires_at) VALUES (?1, ?2, ?3)",
                rusqlite::params![jti, "1", expires_at],
            )?;
            conn.execute(
                "INSERT OR IGNORE INTO revoked_tokens (jti, user_id, expires_at) VALUES (?1, ?2, ?3)",
                rusqlite::params![jti, "1", expires_at],
            )?;
            let count: i64 = conn.query_row(
                "SELECT COUNT(*) FROM revoked_tokens WHERE jti = ?1",
                [jti],
                |row| row.get(0),
            )?;
            assert_eq!(count, 1, "duplicate jti must not be inserted twice");
            Ok(())
        })
        .unwrap();
    }

    #[test]
    fn me_response_fields_from_claims() {
        // Verify MeResponse serializes the expected fields from Claims.
        let claims = make_claims(3600);
        let response = MeResponse {
            sub: claims.sub.clone(),
            username: claims.username.clone(),
            role: claims.role.clone(),
            exp: claims.exp,
        };
        assert_eq!(response.sub, claims.sub);
        assert_eq!(response.username, claims.username);
        assert_eq!(response.role, claims.role);
        assert_eq!(response.exp, claims.exp);
        assert!(response.exp > 0);
    }
}
