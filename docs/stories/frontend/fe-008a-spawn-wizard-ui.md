# [FE-008a] Spawn Wizard - UI Scaffolding

**As a** workspace admin
**I want to** navigate through a multi-step agent spawn wizard with clear step indicators
**So that** I can configure an agent deployment without being overwhelmed by a single complex form

## Acceptance Criteria
- [ ] The `<SpawnWizard>` component opens as a modal dialog from a "Spawn Agent" button in the Agents view
- [ ] The wizard has 3 steps with a step indicator bar showing current step, completed steps, and remaining steps
- [ ] Step 1 (Identity): displays input fields for agent username, personality dropdown, and optional custom prompt textarea
- [ ] Step 2 (Configuration): displays model selector dropdown, room multi-select, and optional tool restriction fields
- [ ] Step 3 (Review): displays a read-only summary of all selections from Steps 1 and 2
- [ ] "Back" and "Next" navigation buttons are present on each step; "Back" is disabled on Step 1, "Next" is replaced by "Spawn" on Step 3
- [ ] The wizard can be cancelled at any step via a "Cancel" button or clicking outside the modal; cancellation discards all entered data
- [ ] Form state is preserved when navigating between steps (going back does not reset fields)
- [ ] The modal is keyboard-accessible: Escape closes it, Tab navigates fields, Enter submits the current step

## Phase
Phase 2 (Interactive Features)

## Priority
P1

## Components
- SpawnWizard
- StepIndicator

## Notes
Split from FE-008. This story covers only the UI structure, navigation, and form layout. Field validation and API submission are covered by FE-008b. Personality options and model options can be hardcoded stubs in this story; the API integration in FE-008b will replace them with server-fetched data.
