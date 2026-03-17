# MH-010: Redirect unauthenticated users to login

**As a** Hive operator
**I want to** ensure unauthenticated users cannot access any protected pages
**So that** the application's content and controls are only visible to logged-in users

## Complexity
S — A route guard component applied at the router level; straightforward but must cover all protected routes and handle edge cases cleanly

## Priority
P0 — Without this, private data and admin controls are exposed to anyone who knows a URL

## Dependencies
- MH-007 (Login page) — redirect destination
- MH-008 (JWT sessions persisting) — guard must read restored auth state correctly
- MH-013 (Basic token-based auth) — guard validates token presence before server round-trip

## Acceptance Criteria
- [ ] Navigating to any protected route while unauthenticated redirects to `/login`
- [ ] The original target URL is preserved as redirect state so the user lands on the intended page after login
- [ ] The redirect happens before any protected content renders — no flash of protected content
- [ ] A user with an expired token is treated as unauthenticated and redirected with a "Session expired" notice
- [ ] Public routes (`/login`, `/setup`, `/health`) are not subject to the redirect guard
- [ ] Server-side rendered or prefetched data for protected routes is not returned to unauthenticated requests (HTTP 401)
- [ ] Direct navigation to `/login` while authenticated redirects to the dashboard, not a loop

## Technical Notes
- Implement as a `<ProtectedRoute>` wrapper component using React Router's `<Outlet>` pattern
- Check auth state from the Zustand/context store synchronously; if state is "loading" (pending rehydration), show a blank or spinner — do not redirect prematurely
- Backend middleware should also enforce auth on all `/api/*` routes except `/api/auth/*` and `/api/health`
- Avoid storing the redirect URL in `localStorage` — pass it via React Router's `state` to keep it in-memory
