# CH-011: Cross-Room Unified Timeline

**As a** workspace user, **I want to** view a unified timeline of messages from all rooms I am subscribed to, **so that** I can monitor activity across the workspace without switching between rooms.

**Complexity:** L
**Priority:** P3
**Phase:** Can Have

## Dependencies
- Multi-room subscription system
- Room messaging API
- Authentication (subscription-based access control)

## Acceptance Criteria
- [ ] Unified timeline merges messages from all subscribed rooms, sorted by timestamp
- [ ] Each message displays room name as a badge/label for context
- [ ] Clicking a message navigates to the full room view at that point in the conversation
- [ ] Filtering by room (multi-select), message type (message, event, system), and author
- [ ] Real-time updates: new messages appear in the timeline as they arrive (WebSocket)
- [ ] Unread indicators show which rooms have new activity
- [ ] Timeline handles high-volume rooms gracefully (virtual scrolling, message batching)
- [ ] User can mute specific rooms from appearing in the timeline without unsubscribing
- [ ] REST API: `GET /api/timeline` with room, author, and type filters
- [ ] Performance: renders within 1 second for up to 1000 messages across 20 rooms
- [ ] Unit tests cover message merging and sorting logic
- [ ] Integration test verifies messages from 3 rooms appear correctly interleaved in the timeline

## Technical Notes
- Use the existing `room poll --rooms` multi-room polling as the backend mechanism
- Virtual scrolling is essential; rendering thousands of DOM nodes will degrade performance
- Consider a "compact mode" that shows only message previews (first line) vs. "full mode"
- Mute state should be client-side (stored in local storage or user preferences)
