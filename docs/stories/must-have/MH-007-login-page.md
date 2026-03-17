# MH-007: Login page wired into router

**As a** user accessing Hive
**I want to** log in through a dedicated login page
**So that** my session is established before I access any protected functionality

## Complexity
S — Standard login form; complexity is in the router integration and redirect-after-login flow

## Priority
P0 — Without a functional login page the entire authenticated surface of the app is inaccessible

## Dependencies
- MH-013 (Basic token-based auth) — login page calls the auth API to obtain a JWT
- MH-008 (JWT sessions persisting) — login must store the token in a way that survives reload
- MH-010 (Redirect unauthenticated users) — login is the destination for those redirects

## Acceptance Criteria
- [ ] A login page exists at `/login` and is publicly accessible (no auth required)
- [ ] Login page renders a username and password field with a submit button
- [ ] Successful login stores the JWT and navigates the user to the originally requested URL (or `/` if no redirect target)
- [ ] Failed login (wrong credentials) shows an inline error message without clearing the username field
- [ ] The password field includes a show/hide toggle
- [ ] Form submits on Enter key press from either field
- [ ] Submitting the form disables the submit button and shows a loading indicator while the request is in flight
- [ ] Navigating to `/login` while already authenticated redirects immediately to the dashboard

## Technical Notes
- Use React Router's `useNavigate` and `useLocation` to capture and restore the pre-login URL (`state.from`)
- Store JWT in `localStorage` (or `httpOnly` cookie if the backend supports it — prefer cookie for XSS resistance)
- Login API: `POST /api/auth/login` with `{ username, password }` body, returns `{ token, expires_at, user }`
- Do not store the raw password anywhere beyond the in-flight request
- Consider rate-limiting the login endpoint (e.g. 10 attempts per minute per IP) to prevent brute force
