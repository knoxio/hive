# CH-014: Thread/Reply View

**As a** room participant, **I want to** reply to specific messages and view threaded conversations, **so that** discussions stay organized and context is preserved when multiple topics are active simultaneously.

**Complexity:** L
**Priority:** P3
**Phase:** Can Have

## Dependencies
- Wire format support for `reply_to` field (already exists in protocol: `Reply` message type)
- Room messaging API
- Web frontend

## Acceptance Criteria
- [ ] Users can reply to a specific message via a reply button or context menu
- [ ] Replies display a preview of the parent message (first line, truncated) above the reply content
- [ ] Clicking the parent preview scrolls to the original message in the timeline
- [ ] A "view thread" action opens a side panel showing the parent message and all its replies in order
- [ ] Thread panel shows reply count and participants
- [ ] New replies in an open thread appear in real time
- [ ] Unread indicators on threaded messages show how many new replies exist
- [ ] Reply messages are visible both inline in the main timeline and in the thread panel
- [ ] CLI support: `room send <room> -t <token> --reply-to <msg-id> "reply text"`
- [ ] Thread depth is limited to 1 level (replies to replies are flat within the thread, not nested)
- [ ] Unit tests cover reply association logic (matching reply_to to parent message)
- [ ] Integration test creates a thread (parent + 3 replies) and verifies thread view retrieves all replies

## Technical Notes
- The `Reply` message type already exists in room-protocol with a `reply_to` field; leverage this
- Thread panel should use the same message rendering component as the main timeline
- Consider a "thread summary" mode for the main timeline (collapse N replies into "N replies" link)
- Store a thread index (parent_id -> [reply_ids]) for efficient thread retrieval
