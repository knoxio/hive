# MH-027: WS auto-reconnect with backoff

**As a** Hive user
**I want to** have my WebSocket connection automatically re-established after a network interruption
**So that** I do not have to manually reload the page after a temporary connectivity issue

## Complexity
M — Reconnection with exponential backoff, catch-up message fetching after reconnect, and prevention of duplicate subscriptions

## Priority
P0 — Without auto-reconnect, any network hiccup breaks the session; users would need to reload constantly

## Dependencies
- MH-022 (Real-time receive via WebSocket) — reconnect restores the real-time delivery pipeline
- MH-026 (Connection status indicator) — reconnect progress must be visible to the user
- MH-013 (Basic token-based auth) — reconnection must re-authenticate using the stored token

## Acceptance Criteria
- [ ] When the WebSocket connection closes unexpectedly, the client attempts to reconnect automatically
- [ ] Reconnect uses exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped), with ±20% jitter
- [ ] After a successful reconnect, the client fetches any messages missed during the outage and inserts them in the correct order
- [ ] After a successful reconnect, the client re-subscribes to all previously subscribed rooms
- [ ] Reconnect attempts stop after 10 consecutive failures; the indicator shows "Disconnected" with a manual Retry button
- [ ] Clicking the manual Retry button resets the backoff counter and starts a fresh reconnect attempt
- [ ] If the page is hidden (tab not in focus), reconnect attempts are paused; they resume immediately when the tab becomes visible
- [ ] No duplicate messages appear after reconnect — catch-up fetch uses the last received message ID as a cursor

## Technical Notes
- Implement the reconnect loop in `wsStore` using `setTimeout` (not `setInterval`) to allow variable delays
- Jitter: `delay = baseDelay * (1 + Math.random() * 0.4 - 0.2)` to spread reconnects from multiple clients
- `document.visibilityState` API for tab-hidden detection; listen to `visibilitychange` event
- Catch-up: after reconnect, call `GET /api/rooms/:id/messages?after=<last_message_id>&limit=200` for each subscribed room
- Prevent re-subscribing if the connection is already open (guard against double-reconnect race)
- Log reconnect attempts at INFO level with attempt number and delay; log final failure at WARN
