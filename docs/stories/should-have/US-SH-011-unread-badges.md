## User Story

As a user, I want to see unread message counts per room in the sidebar so that I know which rooms have new activity.

## Complexity
M (Medium)

## Priority
P2

## Dependencies
- Room list
- WebSocket messages

## Acceptance Criteria
- [ ] Badge on room name showing unread message count
- [ ] Badge clears when the room is opened/focused
- [ ] Unread count persists across page reloads (localStorage)
- [ ] Badge updates in real-time as new messages arrive via WebSocket
- [ ] Distinct styling for rooms with mentions vs. general unreads
- [ ] Rooms with unreads sorted/highlighted in sidebar
