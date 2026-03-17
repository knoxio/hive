# MH-004: First-run wizard (enter daemon URL, verify, create first room)

**As a** new Hive operator
**I want to** be guided through initial setup when I first open the application
**So that** I can connect to my daemon and create my first room without reading documentation

## Complexity
M — Multi-step wizard UI with async verification steps; requires detecting "first run" state and skipping the wizard on subsequent visits

## Priority
P1 — Critical for adoption; a blank screen or cryptic error on first open will cause users to abandon setup

## Dependencies
- MH-001 (CORS) — wizard makes cross-origin requests to verify the daemon URL
- MH-003 (App settings page) — wizard writes to the same settings layer
- MH-013 (Basic token-based auth) — wizard may be pre-auth or integrated with initial user creation
- MH-014 (Create a room) — final wizard step calls the room creation API

## Acceptance Criteria
- [ ] Wizard is displayed automatically on first visit when no daemon URL is configured
- [ ] Wizard is skipped on all subsequent visits once setup is complete
- [ ] Step 1: user enters daemon URL; a "Verify" action sends a health-check request and shows success/failure inline
- [ ] Step 2: user sets admin credentials (username + password); form validates password strength and confirmation match
- [ ] Step 3: user names and creates the first room; room appears immediately in the room list after wizard completion
- [ ] Wizard prevents advancing to the next step if the current step has validation errors
- [ ] User can go back to a previous step and correct inputs without losing later-step data
- [ ] Completing the wizard marks setup as done in persistent storage so the wizard never reappears
- [ ] If the wizard is abandoned mid-way, state is preserved so the user can resume from where they left off

## Technical Notes
- Track wizard completion with an `app_settings` key `setup_complete = true`
- On the frontend, check this flag before rendering the main app shell; redirect to `/setup` if not set
- Wizard steps should be URL-addressable (e.g. `/setup/daemon`, `/setup/account`, `/setup/first-room`) to support back/forward navigation
- Health check in step 1 should hit the daemon's `/api/health` endpoint; timeout after 5 seconds
- Step 2 password hashing must use argon2 or bcrypt — never store plaintext
