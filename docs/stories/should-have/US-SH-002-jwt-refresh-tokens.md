## User Story

As a user, I want my session to auto-refresh transparently so that I am not logged out unexpectedly while actively using Hive.

## Complexity
M (Medium)

## Priority
P1

## Dependencies
- Basic auth (#61)

## Acceptance Criteria
- [ ] Refresh endpoint issues new access token given a valid refresh token
- [ ] Token rotation: refresh token is single-use (rotated on each refresh)
- [ ] Access token expiry is enforced server-side (e.g., 15 min)
- [ ] Refresh token has a longer expiry (e.g., 7 days)
- [ ] Client auto-refreshes before access token expires (background fetch)
- [ ] Graceful re-login prompt when refresh token is also expired
- [ ] Revoked refresh tokens cannot be reused
