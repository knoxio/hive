# MH-021: Send a message

**As a** room member
**I want to** type and send a message to a room
**So that** I can communicate with other members and agents in that room

## Complexity
S — Text input and API call; complexity is in optimistic updates, error recovery, and @mention support

## Priority
P0 — Sending messages is the core functionality of the application

## Dependencies
- MH-013 (Basic token-based auth) — sending requires authentication
- MH-017 (Switch between rooms) — messages are sent to the active room
- MH-022 (Real-time receive via WebSocket) — sent messages should appear via the WebSocket echo, not a duplicate HTTP response

## Acceptance Criteria
- [ ] A text input is present at the bottom of the room view when the user is a member of the room
- [ ] Pressing Enter sends the message; Shift+Enter inserts a newline
- [ ] The message input is cleared after a successful send
- [ ] Sent messages appear in the chat immediately (optimistic update) before server confirmation
- [ ] If the send fails, the optimistic message is marked with an error indicator and a Retry action
- [ ] Messages are limited to 4000 characters; exceeding the limit shows an inline character counter turning red and prevents submission
- [ ] @mention autocomplete appears when the user types `@` followed by at least one character, showing matching room members
- [ ] Users with `viewer` role see the input as disabled with a tooltip explaining they cannot send messages

## Technical Notes
- API: `POST /api/rooms/:id/messages` with `{ content: string }`; returns the created message
- After a successful send, the message arrives via WebSocket (the server echoes it to all room members including the sender) — do not add it to the list again from the HTTP response
- Optimistic update: assign a temporary client-side ID; replace with the server ID when the WebSocket echo arrives
- @mention parsing: use the room member list (MH-020) as the autocomplete source; send raw content with `@username` — let the server parse mentions
- Warn before leaving the page (or switching rooms) if there is unsent text in the input
