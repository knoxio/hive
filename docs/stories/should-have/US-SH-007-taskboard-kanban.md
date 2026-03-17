## User Story

As a user, I want a visual kanban board for the taskboard so that I can see task status at a glance and manage tasks with drag-and-drop.

## Complexity
L (Large)

## Priority
P2

## Dependencies
- Taskboard plugin data

## Acceptance Criteria
- [ ] Columns for Open, Claimed, Planned, Approved, and Finished statuses
- [ ] Tasks displayed as cards with title, assignee, and elapsed time
- [ ] Drag-and-drop to change task status between columns
- [ ] Task detail modal on card click (shows full description, plan, notes)
- [ ] Real-time updates when tasks change (via WebSocket)
- [ ] Visual indicators for lease expiry (warning when close to TTL)
- [ ] Filter/search tasks within the kanban view
