# MH-022: Real-time receive via WebSocket

**As a** room member
**I want to** receive new messages in real time without polling or refreshing
**So that** I can have a fluid conversation experience

## Complexity
L — WebSocket connection management is deceptively complex: authentication, multiplexing multiple rooms, reconnection, and message ordering all interact

## Priority
P0 — Without real-time delivery the chat is useless; polling would be an unacceptable fallback for interactive use

## Dependencies
- MH-013 (Basic token-based auth) — WebSocket connection must be authenticated
- MH-027 (WS auto-reconnect) — real-time delivery depends on reconnection logic
- MH-026 (Connection status indicator) — WS state must be surfaced to the user

## Acceptance Criteria
- [ ] A WebSocket connection is established on login and remains open for the session
- [ ] New messages sent by other users in any joined room appear in the correct room's chat view within 500ms under normal conditions
- [ ] The WebSocket connection carries events for multiple rooms on a single connection (no per-room connections)
- [ ] WebSocket authentication uses the JWT token in the connection URL query parameter or the first frame handshake — not in the HTTP upgrade headers (browser limitation)
- [ ] Non-message events (room created/deleted, member joined/left, presence changed) are also delivered over the same connection
- [ ] Messages received out of order (by timestamp) are inserted at the correct position in the chat history
- [ ] Duplicate messages (from optimistic updates) are deduplicated using the server-assigned message ID
- [ ] The connection drops gracefully when the user logs out — no ghost messages delivered after logout

## Technical Notes
- Backend: upgrade `/ws` to a WebSocket connection; after authentication, subscribe the connection to all rooms the user is a member of
- Message envelope: `{ type: "message" | "event", room_id, payload }` — allows the client to route to the correct room store
- Deduplication: maintain a `Set<messageId>` in the room's message list; skip insertion if ID already present
- Ordering: messages carry a server-assigned monotonic sequence number per room; use this to detect and handle gaps
- Consider a single global WS connection (Zustand `wsStore`) rather than per-room connections to avoid connection exhaustion
- The Hive backend should proxy WebSocket events from the underlying daemon, enriching them with Hive-level metadata (user IDs, display names)
