# US-BE-033: WebSocket event subscription filtering

**As a** frontend client
**I want to** subscribe to specific event types on a WebSocket connection
**So that** I only receive the events I need and reduce bandwidth and rendering overhead

## Acceptance Criteria
- [ ] Clients can send a subscription frame after connecting: `{"type":"subscribe","events":["AgentStarted","AgentStopped","TaskPosted","TaskClaimed","Message"]}`
- [ ] Only events matching the subscribed types are forwarded to the client; unsubscribed event types are silently dropped
- [ ] If no subscription frame is sent, the client receives all events (backward-compatible default)
- [ ] Clients can update their subscription at any time by sending a new `subscribe` frame; it fully replaces the previous subscription
- [ ] An `unsubscribe` frame removes all filters and returns to receiving all events: `{"type":"unsubscribe"}`
- [ ] The server acknowledges subscription changes with `{"type":"subscribed","events":["..."]}`
- [ ] Invalid event type names in the subscription are rejected with `{"type":"error","message":"unknown event type: Foo"}`
- [ ] Supported event types include at minimum: `Message`, `DirectMessage`, `Join`, `Leave`, `AgentStarted`, `AgentStopped`, `TaskPosted`, `TaskClaimed`, `TaskFinished`, `System`, `Error`

## Technical Notes
- Implement filtering logic in `crates/hive-server/src/ws_relay.rs` (or a dedicated `ws_filter.rs` module)
- Each WS session holds a `HashSet<String>` of subscribed event types; default is empty (meaning "all")
- Before forwarding a frame to the client, parse the `type` field from the JSON and check against the subscription set
- Parsing every frame has a cost; consider a fast-path check: if the subscription set is empty, skip parsing entirely
- Event type names should match the `EventType` enum in `room-protocol` plus the `Message.type` variants (`message`, `join`, `leave`, `system`, etc.)
- This is client-side filtering only; the upstream daemon connection still receives all events to avoid complex per-client daemon subscriptions

## Phase
Phase 2 (Interactive Features)
