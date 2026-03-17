# MH-009: Logout functionality

**As a** logged-in user
**I want to** log out of Hive
**So that** my session is terminated and my credentials are not accessible to the next person using the device

## Complexity
S — Simple UI action with token revocation call; complexity is in ensuring all client state is cleared

## Priority
P0 — Without logout, sessions cannot be terminated; security and shared-device scenarios are broken

## Dependencies
- MH-007 (Login page) — logout redirects here
- MH-008 (JWT sessions persisting) — logout must clear persisted storage
- MH-013 (Basic token-based auth) — backend must revoke or invalidate the token on logout

## Acceptance Criteria
- [ ] A logout action is accessible from the main navigation (e.g. user menu or top bar)
- [ ] Clicking logout sends a `POST /api/auth/logout` request to invalidate the server-side session/token
- [ ] After logout, all locally stored tokens and session data are cleared regardless of whether the server request succeeded
- [ ] After logout, the user is redirected to the login page
- [ ] After logout, navigating back (browser back button) to a protected page redirects to login rather than showing stale content
- [ ] Logout is confirmed with a brief visual feedback (e.g. loading indicator) before redirect
- [ ] A failed logout API call still clears local state and redirects to login — never leaves the user in a partially-logged-out state

## Technical Notes
- Backend: on logout, add the token's `jti` to a revocation list (in-memory or DB) valid until the token's natural expiry
- If using `httpOnly` cookies, the logout endpoint must `Set-Cookie` with an expired cookie to clear it
- Client: clear Zustand/context auth state, remove any `localStorage` items, close the WebSocket connection
- Do not show a confirmation dialog for logout — it is a low-risk destructive action and dialogs add friction
