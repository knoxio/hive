# MH-028: User preferences (display name, notifications, theme)

**As a** Hive user
**I want to** configure my personal preferences including display name, notification settings, and UI theme
**So that** I can tailor the application to my working style

## Complexity
M — Multiple preference categories require a structured settings page; notification permissions involve browser API interactions; theme switching requires CSS variable/class management

## Priority
P1 — Preferences don't block core functionality but directly impact daily usability and user satisfaction

## Dependencies
- MH-007 (Login page) — preferences are only accessible to authenticated users
- MH-010 (Redirect unauthenticated users) — preferences route must be protected
- MH-011 (User profile) — display name is shared between profile and preferences

## Acceptance Criteria
- [ ] A user preferences page is accessible from the user menu at a stable route (e.g. `/settings/preferences`)
- [ ] Display name field is pre-populated from the current profile and saves changes to the profile API
- [ ] Theme selector offers at minimum: System (follow OS), Light, Dark; applied immediately without page reload
- [ ] Selected theme persists across page reloads and browser sessions
- [ ] Notification settings allow enabling/disabling: @mention notifications, direct message notifications, all-room notifications
- [ ] If browser notifications are enabled, the app requests permission the first time the user turns them on; denied permission is handled gracefully with an explanation
- [ ] Preferences are saved per-user and sync across devices (stored server-side, not just localStorage)
- [ ] A "Reset to defaults" button is available on the preferences page to restore all settings to their initial values

## Technical Notes
- Theme: apply a `data-theme="dark"` attribute to `<html>` and drive all colours with CSS custom properties; use `prefers-color-scheme` media query for System default
- Preference storage: `PATCH /api/users/me/preferences` with a JSON body of changed keys; `GET /api/users/me/preferences` on app load
- Notification API: `Notification.requestPermission()` — only call on user gesture (button click), never proactively
- Keep preference keys namespaced (e.g. `{ ui: { theme, density }, notifications: { mentions, dms, rooms } }`) to allow partial updates
- Cache preferences in Zustand; optimistically apply theme changes before the server round-trip completes
