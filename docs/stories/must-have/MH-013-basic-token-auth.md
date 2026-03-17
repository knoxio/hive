# MH-013: Basic token-based auth

**As a** Hive backend
**I want to** issue and validate JWT tokens for all API requests
**So that** only authenticated users can access protected resources

## Complexity
M — JWT issuance and validation are well-understood but require careful handling of signing keys, expiry, and revocation

## Priority
P0 — Every other auth story depends on this; it is the foundation of the entire security model

## Dependencies
- No story dependencies — this is foundational; all other auth stories build on it

## Acceptance Criteria
- [ ] `POST /api/auth/login` accepts `{ username, password }` and returns a signed JWT on success
- [ ] JWT payload contains at minimum: `sub` (user ID), `username`, `role`, `iat`, `exp`, `jti` (unique token ID)
- [ ] Token TTL is configurable via environment variable (default 24 hours)
- [ ] All protected endpoints validate the JWT signature and expiry before processing the request
- [ ] An invalid or expired token returns HTTP 401 with a structured error body `{ code: "UNAUTHORIZED", message: "..." }`
- [ ] A missing token on a protected endpoint returns HTTP 401 (not 403 or 404)
- [ ] Signing key is loaded from an environment variable (`HIVE_JWT_SECRET`); startup fails with a clear error if the variable is absent or too short (< 32 bytes)
- [ ] Unit tests cover: valid token, expired token, tampered signature, missing token, wrong algorithm

## Technical Notes
- Algorithm: HS256 minimum; RS256 preferred for production (allows public key distribution)
- Use `jsonwebtoken` crate (Rust) or equivalent; do not roll a custom JWT implementation
- Token revocation: maintain a `revoked_tokens` table keyed by `jti`; check on every request until the token's natural expiry, then remove the row
- Middleware: implement as a tower `Layer` or axum `middleware::from_fn` that extracts the token from the `Authorization: Bearer <token>` header
- Refresh tokens are out of scope for this story — add in a follow-up if session TTL proves too short
- Log authentication failures at WARN level with the IP address (but never the token or password)
