# MH-003: App settings page (configure daemon URL, port)

**As a** Hive administrator
**I want to** configure the daemon connection URL and port through a settings page
**So that** I can point Hive at different daemon instances without editing config files or redeploying

## Complexity
M — Requires a settings persistence layer (DB or config file), a settings API, and a frontend settings page with validation

## Priority
P1 — Essential for multi-environment deployments; without it, changing the daemon target requires a redeploy

## Dependencies
- MH-007 (Login page) — settings page must be behind auth
- MH-010 (Redirect unauthenticated users) — settings route must be protected
- MH-013 (Basic token-based auth) — settings mutations must require a valid session
- MH-029 (App config editable post-login) — this story is the backend counterpart

## Acceptance Criteria
- [ ] Settings page is accessible at a stable route (e.g. `/settings/app`) from the main navigation
- [ ] Page displays current daemon URL and port with an edit form
- [ ] Saving a new URL immediately updates the value used for all subsequent daemon API calls (no restart required)
- [ ] Invalid URLs (malformed, unreachable) produce a clear inline validation error before saving
- [ ] A "Test connection" button sends a health-check request to the configured URL and displays success or error inline
- [ ] Settings are persisted across page reload and server restart
- [ ] Only users with admin role can modify app-level settings (read access for all authenticated users)
- [ ] Settings page is not accessible to unauthenticated users — redirects to login

## Technical Notes
- Store settings in a `app_settings` table with `key`, `value`, `updated_at`, `updated_by` columns
- Backend exposes `GET /api/settings` and `PATCH /api/settings` endpoints
- Frontend should debounce connection test to avoid hammering the daemon on every keystroke
- Consider a separate `settings` Zustand slice or React context to propagate the active daemon URL to all API clients
- Default daemon URL should come from the `HIVE_DAEMON_URL` environment variable, seeded into the DB on first run
