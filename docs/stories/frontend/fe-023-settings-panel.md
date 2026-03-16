# FE-023: Settings Panel

## User Story
As a user, I want a settings view where I can configure my theme preference, notification behavior, API keys, and workspace defaults, so that I can customize Hive to match my workflow without editing configuration files.

## Acceptance Criteria
1. A Settings view is accessible from the main navigation sidebar and from a user avatar dropdown menu; it opens as a full-page route (`/settings`), not a modal.
2. The Theme section offers Light, Dark, and System (auto-detect) options; selecting an option applies the theme immediately without a page reload and persists the preference to the backend.
3. The Notifications section allows toggling: desktop notifications (browser Notification API), sound alerts, and per-workspace mute overrides; changes take effect immediately.
4. The API Keys section displays existing keys (masked, showing only the last 4 characters), their creation date, and last-used date; users can create new keys (with an optional label) and revoke existing keys with a confirmation dialog.
5. The Workspace Defaults section lets the user set a default workspace (auto-selected on login) and default subscription tier for new room joins (Full or MentionsOnly).
6. All settings changes are saved to the backend via `PUT /api/user/settings` and optimistically applied to the UI; if the save fails, the UI reverts the change and displays an error toast.
7. The Settings view is fully keyboard-navigable; each section is a landmark region with a heading, and all form controls have associated labels.
8. Unit tests cover each settings section component in isolation; an integration test verifies the round-trip: change setting, reload page, confirm setting persists.

## Technical Notes
- Use a tabbed or sectioned layout within the Settings page (Theme, Notifications, API Keys, Workspace Defaults). Avoid a single long scrollable form.
- Theme state should live in a React context (or equivalent framework state) that wraps the entire app, so all components react to theme changes without prop drilling.
- API key creation should return the full key exactly once (in the creation response). Display it in a copy-to-clipboard field with a warning that it will not be shown again.
- For desktop notifications, request `Notification.permission` on toggle-on; if the user has previously denied permission, show a help message explaining how to re-enable it in browser settings.
- Dark mode implementation should use CSS custom properties (variables) on `:root` / `[data-theme="dark"]` rather than conditional class lists on individual components, to keep theme switching performant and maintainable.
- Consider debouncing settings saves (300ms) for rapid toggles to avoid excessive API calls.

## Phase & Priority
- **Phase:** 2
- **Priority:** P2

## Dependencies
- Blocked by: FE-002 (login/auth — user must be authenticated to load and save settings), FE-022 (dark mode foundation — theme infrastructure must exist before the settings panel can toggle it)
- Blocks: none currently identified
- Related: US-BE-008 (backend auth — settings endpoint requires authentication), US-BE-027 (rate limiting — API key management ties into rate limit identity)
