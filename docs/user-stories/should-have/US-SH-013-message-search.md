## User Story

As a user, I want to search messages across all rooms so that I can find past conversations and decisions regardless of which room they occurred in.

## Complexity
L (Large)

## Priority
P3

## Dependencies
- Message history
- Room list

## Acceptance Criteria
- [ ] Global search bar accessible from any view
- [ ] Search results show message content with room context (room name, timestamp, sender)
- [ ] Click on result jumps to the message in context (scrolls to message in room)
- [ ] Regex search support
- [ ] Filter by room, user, date range
- [ ] Results paginated for large result sets
- [ ] Uses the existing query infrastructure (QueryFilter)
