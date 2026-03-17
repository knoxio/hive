## User Story

As a user, I want to create and delete rooms from the web interface so that I can manage room lifecycle without using the CLI.

## Complexity
M (Medium)

## Priority
P1

## Dependencies
- Room list
- Daemon API

## Acceptance Criteria
- [ ] Create room button in room settings or sidebar
- [ ] Room name input with validation (matches validate_room_id rules)
- [ ] Delete room with confirmation dialog (warns about data loss)
- [ ] Newly created room appears in the room list immediately
- [ ] Deleted room disappears from the room list immediately
- [ ] Room creation calls daemon CREATE endpoint
- [ ] Room deletion calls daemon DESTROY endpoint
- [ ] Error handling for name conflicts and permission errors
