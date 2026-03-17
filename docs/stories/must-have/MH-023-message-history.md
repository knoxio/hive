# MH-023: Message history with scroll-back

**As a** room member
**I want to** scroll back through previous messages in a room
**So that** I can read conversations that happened before I joined the view or while I was away

## Complexity
M — Infinite scroll with bidirectional loading, cursor-based pagination, and scroll position preservation across room switches

## Priority
P0 — Without history, the chat is ephemeral from the user's perspective; context is lost on every reload

## Dependencies
- MH-022 (Real-time receive via WebSocket) — new messages are appended to the history view
- MH-017 (Switch between rooms) — history must load when entering a room
- MH-013 (Basic token-based auth) — history fetch requires authentication

## Acceptance Criteria
- [ ] When entering a room, the last 50 messages are loaded and displayed
- [ ] Scrolling to the top of the message list triggers a load of the previous 50 messages (infinite scroll upwards)
- [ ] A loading spinner is shown at the top while older messages are fetching
- [ ] When there are no more messages to load, a "Beginning of conversation" indicator is shown instead of the spinner
- [ ] Loading older messages does not cause the visible content to jump — the scroll position is anchored to the current bottom-most visible message
- [ ] Messages display: sender avatar, display name, timestamp (relative for recent, absolute on hover), and message content
- [ ] Messages from the same sender within 5 minutes are visually grouped (avatar shown only on first message)
- [ ] The message list is virtualised for rooms with more than 200 messages to avoid DOM bloat

## Technical Notes
- API: `GET /api/rooms/:id/messages?before=<message_id>&limit=50` for backward pagination
- Use cursor-based pagination (message ID, not offset) — offset pagination is unreliable with concurrent inserts
- Scroll anchoring: before inserting historical messages at the top, record `scrollHeight` and `scrollTop`; after insert, set `scrollTop += newScrollHeight - oldScrollHeight`
- Virtualisation: use `react-virtual` or `@tanstack/react-virtual` to render only visible messages
- Message timestamps: use a library like `date-fns` for relative formatting; update relative times every minute
- Store history per room in Zustand; cap in-memory history at 500 messages per room to limit memory usage
