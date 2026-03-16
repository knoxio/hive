# [FE-008b] Spawn Wizard - Validation and API Integration

**As a** workspace admin
**I want to** have my spawn wizard inputs validated and submitted to the Hive server API
**So that** agents are deployed correctly and I get clear feedback on errors

## Acceptance Criteria
- [ ] Field validation runs on blur and on "Next" / "Spawn" click; invalid fields show inline error messages below the input
- [ ] Validation rules: username is required, 1-32 chars, alphanumeric + hyphens only, no leading hyphen; at least one room must be selected; model is required
- [ ] Duplicate username detection: on blur of the username field, an API call checks if the username is already taken in the workspace; if so, an inline error is shown
- [ ] Personality dropdown and model selector are populated from server endpoints (`GET /api/personalities`, `GET /api/models`)
- [ ] On "Spawn" click (Step 3), a POST request is sent to the Hive server spawn endpoint with the wizard's form data
- [ ] While the spawn request is in flight, a progress indicator replaces the "Spawn" button and all inputs are disabled
- [ ] On success, the modal closes and the new agent appears in the `<AgentGrid>` with "Starting..." status that transitions to healthy on first heartbeat
- [ ] On API error (4xx/5xx), the error message is displayed in the Review step without closing the modal; the user can go back and fix inputs
- [ ] Network errors (timeout, connection refused) show a generic "Could not reach server" message with a "Retry" button

## Phase
Phase 2 (Interactive Features)

## Priority
P1

## Components
- SpawnWizard
- AgentGrid

## Notes
Split from FE-008. Depends on FE-008a for the wizard UI scaffolding. The spawn request maps to the agent spawn API (US-BE-012). Username uniqueness check should be debounced (300ms) to avoid excessive API calls during typing.
