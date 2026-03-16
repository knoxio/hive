# US-BE-030: WebSocket Permission Filtering

## User Story
As a user connected to Hive via WebSocket, I want the relay to enforce message visibility rules (DM privacy, subscription tiers, and private room access), so that I only receive messages I am authorized to see.

## Acceptance Criteria
1. Direct messages are delivered only to the sender, the recipient, and workspace hosts; no other WebSocket client receives DM frames.
2. Subscription tiers (Full, MentionsOnly, Unsubscribed) are enforced on the relay: clients subscribed as MentionsOnly receive only messages that @mention them; Unsubscribed clients receive no messages from that room unless they explicitly poll with a narrowing filter.
3. Private rooms (when room visibility is implemented) are invisible to non-members: connection attempts to a private room WebSocket endpoint return a 403 Forbidden upgrade rejection, and messages from private rooms are never relayed to non-member connections.
4. Permission checks are evaluated per-frame before relay, not as a post-filter on the client side; unauthorized frames are silently dropped at the server (no error frame sent to the intended recipient to avoid information leakage).
5. When a user's subscription tier changes mid-session (e.g., upgraded from MentionsOnly to Full), the relay applies the new tier immediately without requiring reconnection.
6. Token validation occurs on every WebSocket frame relay cycle; if a token is revoked (via /kick or /reauth), the connection is terminated with a 4001 close code and a JSON reason frame within 5 seconds.
7. Integration tests cover: DM isolation (third-party client must not see DMs), MentionsOnly filtering (non-mentioned messages dropped), private room rejection, mid-session tier change, and revoked-token disconnection.

## Technical Notes
- The relay filter should be a function `fn is_visible_to(msg: &Message, client: &ClientState) -> bool` consistent with the existing `is_visible_to` implementation in the room broker. Reuse or delegate to the same logic to avoid divergence.
- Store each WebSocket client's subscription tiers and room memberships in the relay's connection state (`ClientState`). Update this state on subscription change events without tearing down the socket.
- For token revocation, maintain a `revoked_tokens: HashSet<Uuid>` that is checked on each relay cycle. Alternatively, use a broadcast channel to notify all relay tasks of revocation events.
- Frame drop (silent) vs. error frame (noisy): silent drop is the correct default for authorization failures. Only send error frames for client-side errors (malformed JSON, unknown room ID).
- Performance consideration: permission checks must be O(1) per frame. Avoid database queries in the hot path; cache permissions in memory and invalidate on change events.

## Phase & Priority
- **Phase:** 2
- **Priority:** P1

## Dependencies
- Blocked by: US-BE-003 (WebSocket relay — the relay infrastructure must exist before filtering can be layered on), US-BE-011 (token mapping — token-to-user resolution is required for permission lookups)
- Blocks: none currently identified
- Related: US-BE-008 (authentication — token validation is a prerequisite for permission enforcement), US-BE-027 (rate limiting — both operate as per-frame middleware in the relay pipeline)
