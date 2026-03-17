# MH-008: JWT sessions persisting across page reload

**As a** logged-in user
**I want to** remain authenticated after reloading the page or closing and reopening the browser tab
**So that** I don't have to log in repeatedly during a work session

## Complexity
S — Token storage and rehydration are straightforward; the main risk is security pitfalls (XSS, token expiry handling)

## Priority
P0 — Without persistence, every page load requires re-authentication, making the app unusable

## Dependencies
- MH-007 (Login page) — login is where the token is first obtained
- MH-013 (Basic token-based auth) — token validation happens server-side
- MH-009 (Logout) — logout must clear the persisted token

## Acceptance Criteria
- [ ] After logging in, refreshing the page keeps the user authenticated without a new login prompt
- [ ] The authentication state is restored from storage before any protected route renders, preventing a flash of the login page
- [ ] An expired or invalid token in storage is detected on app load; the user is silently redirected to login with a "Session expired" message
- [ ] Token expiry is checked client-side on app load and on each API request — no request is made with a known-expired token
- [ ] Closing the browser tab and reopening it within the token TTL keeps the session active
- [ ] The stored token is not accessible to third-party scripts — stored in `httpOnly` cookie if backend supports it, otherwise with XSS mitigations documented
- [ ] Auth state is shared across browser tabs opened to the same origin — logging out in one tab logs out all tabs within 30 seconds

## Technical Notes
- Preferred storage: `httpOnly` `Secure` `SameSite=Strict` cookie set by the backend on login response
- Fallback if cookie approach is not feasible: `localStorage` with explicit XSS risk documentation in the security notes
- On app boot, call `GET /api/auth/me` with the stored token to validate it; treat 401 as "session expired"
- Use a React context or Zustand store for `{ user, token, isAuthenticated }` — initialise from storage synchronously before first render to avoid flash
- For cross-tab logout: listen to `storage` events (if using localStorage) or use a BroadcastChannel
