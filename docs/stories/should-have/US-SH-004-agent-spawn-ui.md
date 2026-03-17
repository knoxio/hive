## User Story

As a user, I want to launch agents directly from the Hive web interface so that I can start agent work without using the CLI.

## Complexity
XL (Extra Large)

## Priority
P1

## Dependencies
- Agent list (#66)
- room-ralph integration

## Acceptance Criteria
- [ ] Spawn button visible in the agent management panel
- [ ] Personality picker allows selecting from available agent personalities
- [ ] Model selector allows choosing the LLM model (e.g., Claude Sonnet, Opus)
- [ ] Confirmation dialog before spawning (shows selected options)
- [ ] Agent appears in the agent list after successful spawn
- [ ] Spawn errors are surfaced clearly in the UI
- [ ] Room assignment is configurable during spawn
- [ ] Agent process is managed via room-ralph under the hood
