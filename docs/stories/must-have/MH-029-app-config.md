# MH-029: App config (daemon URL editable post-login)

**As a** logged-in Hive administrator
**I want to** change the daemon connection URL after initial setup
**So that** I can migrate to a new daemon instance or correct a misconfigured URL without redeploying

## Complexity
S — Edit form backed by the same settings layer as MH-003; primary complexity is in propagating the change to the active WebSocket connection

## Priority
P1 — Without this, changing the daemon target after setup requires access to environment variables or a redeploy; blocks operational flexibility

## Dependencies
- MH-003 (App settings page) — this story extends MH-003 with post-login editability
- MH-013 (Basic token-based auth) — config changes require admin authentication
- MH-027 (WS auto-reconnect) — changing the daemon URL must trigger a reconnect to the new URL

## Acceptance Criteria
- [ ] The app config section of the settings page (`/settings/app`) allows editing the daemon URL while logged in
- [ ] The current daemon URL is shown in an editable input with its current value pre-filled
- [ ] A "Test connection" button sends a health-check request to the new URL and shows success or failure inline before saving
- [ ] Saving a new daemon URL immediately updates all API calls and WebSocket connections to target the new URL — no page reload required
- [ ] If the new URL is unreachable (test fails), the save button is disabled until either the test passes or the user explicitly overrides
- [ ] Config changes are restricted to admin users; the section is hidden or read-only for other roles
- [ ] After a successful daemon URL change, a success notification is shown and the connection status indicator reflects the new connection state
- [ ] The previous daemon URL is kept in a change log (last 5 values) accessible to admins for rollback reference

## Technical Notes
- API: `PATCH /api/settings` with `{ daemon_url: string }`; validates URL format server-side
- On save, the backend updates the `app_settings` table and broadcasts a `settings_changed` WebSocket event
- Frontend: on receiving `settings_changed`, update the API client base URL and trigger a WebSocket reconnect to the new daemon URL
- URL validation: must be a valid HTTP(S) or WS(S) URL; reject bare hostnames without scheme
- Change log: store in `app_settings_history` table with `key`, `old_value`, `new_value`, `changed_by`, `changed_at`; expose via `GET /api/settings/history?key=daemon_url&limit=5`
