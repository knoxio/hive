# CH-004: Agent Personality Editor

**As a** workspace administrator, **I want to** create and edit agent personalities through a UI editor, **so that** I can customize agent behavior, tone, and expertise without editing raw configuration files.

**Complexity:** M
**Priority:** P3
**Phase:** Can Have

## Dependencies
- Agent personality system (backend storage and application of personality configs)
- Agent registry

## Acceptance Criteria
- [ ] Editor UI allows creating a new personality with: name, system prompt, tone descriptors, expertise tags, and constraints
- [ ] Editor provides a live preview pane showing how the personality affects a sample conversation
- [ ] Personalities can be saved, duplicated, edited, and deleted
- [ ] Personalities can be assigned to one or more agents
- [ ] Changing a personality on a running agent takes effect on the next message (no restart required)
- [ ] A library of built-in personality templates is available (e.g., "code reviewer", "technical writer", "QA tester")
- [ ] Personality definitions are stored as structured data (JSON/TOML), not free-text blobs
- [ ] Validation prevents empty system prompts or names exceeding 100 characters
- [ ] REST API supports full CRUD for personalities (`/api/personalities`)
- [ ] Unit tests cover personality validation and template rendering
- [ ] Integration test verifies assigning a personality to an agent and confirming it appears in agent metadata

## Technical Notes
- System prompt is the primary mechanism; tone/expertise tags are metadata for filtering and search
- Consider a diff view when editing to show what changed
- Personality templates should be shipped as static assets, not hardcoded in source
- Max system prompt length should be configurable (default: 4000 characters)
