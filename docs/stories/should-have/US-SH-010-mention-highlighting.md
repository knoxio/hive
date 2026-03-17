## User Story

As a user, I want @mentions to be visually highlighted in messages and trigger notifications so that I notice when someone is addressing me.

## Complexity
M (Medium)

## Priority
P2

## Dependencies
- Chat system
- User list

## Acceptance Criteria
- [ ] @username rendered with distinct highlight styling in messages
- [ ] Autocomplete dropdown when typing @ in the message input
- [ ] Browser notification triggered when mentioned (if permission granted)
- [ ] Unread count badge specifically for mentions
- [ ] Mention notification links to the specific message
- [ ] Works with parse_mentions from room-protocol
- [ ] Autocomplete shows online users first, then offline
