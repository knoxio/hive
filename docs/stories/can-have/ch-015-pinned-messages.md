# CH-015: Pinned Messages

**As a** room participant, **I want to** pin important messages to a room so they remain easily accessible, **so that** key decisions, links, and instructions are not lost in the message stream.

**Complexity:** S
**Priority:** P3
**Phase:** Can Have

## Dependencies
- Room messaging API
- Authentication/authorization (who can pin/unpin)

## Acceptance Criteria
- [ ] Any room member can pin a message via a context menu action
- [ ] Pinned messages are displayed in a dedicated "Pinned" panel accessible from the room header
- [ ] Pinned messages show: content, author, pin timestamp, and who pinned it
- [ ] Maximum of 50 pinned messages per room (configurable)
- [ ] Pinned messages can be unpinned by the pinner, the message author, or an admin
- [ ] A system message is posted when a message is pinned or unpinned ("alice pinned a message")
- [ ] Pinned messages persist across restarts (stored alongside room data)
- [ ] CLI support: `room send <room> -t <token> /pin <msg-id>` and `/unpin <msg-id>`
- [ ] REST API: `GET /api/rooms/{id}/pins`, `POST /api/rooms/{id}/pins`, `DELETE /api/rooms/{id}/pins/{msg-id}`
- [ ] Unit tests cover pin/unpin logic and max-pin enforcement
- [ ] Integration test pins a message and verifies it appears in the pins list

## Technical Notes
- Store pins as a separate data structure (not a flag on the message) to avoid mutating chat history
- Pin data: `{msg_id, pinned_by, pinned_at}`
- Consider ordering pins by pin time (newest first) or allowing manual reordering
