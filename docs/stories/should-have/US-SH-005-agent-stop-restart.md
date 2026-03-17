## User Story

As a user, I want to stop or restart running agents from the web interface so that I can manage agent lifecycle without CLI access.

## Complexity
L (Large)

## Priority
P1

## Dependencies
- Agent spawn (US-SH-004)
- room-ralph integration

## Acceptance Criteria
- [ ] Stop button displayed per running agent
- [ ] Restart button displayed per running agent
- [ ] Confirmation dialog before stop/restart actions
- [ ] Agent status updates in real-time after stop/restart (no page reload needed)
- [ ] Stopped agents show as stopped in the agent list
- [ ] Restart preserves the agent's configuration (personality, model, room)
- [ ] Graceful shutdown: agent finishes current task before stopping
