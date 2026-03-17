# MH-026: Connection status indicator

**As a** Hive user
**I want to** see a clear indicator of my connection status to the daemon
**So that** I know whether my messages are being delivered and whether I am seeing live data

## Complexity
S — WebSocket state machine is already required for MH-022; this story adds a UI indicator driven by that state

## Priority
P0 — Users must know when they are disconnected to avoid sending messages into the void or trusting stale data

## Dependencies
- MH-022 (Real-time receive via WebSocket) — the WebSocket connection state is the source of truth
- MH-027 (WS auto-reconnect) — indicator must reflect reconnect progress

## Acceptance Criteria
- [ ] A persistent connection status indicator is visible in the app shell at all times (e.g. top bar or status bar)
- [ ] Connected state shows a green indicator (or no indicator if connected is the default "quiet" state)
- [ ] Reconnecting state shows an amber indicator with an animated pulse and the text "Reconnecting…"
- [ ] Disconnected state (reconnect failed or explicitly offline) shows a red indicator with "Disconnected" text and a manual "Retry" button
- [ ] The indicator transitions smoothly between states without flickering on brief disconnects (debounce < 2 seconds before showing disconnected)
- [ ] Hovering the indicator shows a tooltip with: current status, last connected timestamp, daemon URL, and next retry time (if reconnecting)
- [ ] When the connection is restored after an outage, a brief "Connected" toast is shown and then the indicator returns to the quiet state

## Technical Notes
- Connection state machine: `connected` → `disconnecting` → `disconnected` → `reconnecting` → `connected`
- Expose state from the global `wsStore` (Zustand); the indicator component subscribes to it
- Do not show "Disconnected" immediately on first WebSocket close event — wait 2 seconds before transitioning to avoid flicker on brief network hiccups
- The "Retry" button in the disconnected state should call the manual reconnect function in `wsStore`, bypassing the backoff timer
- Consider adding a visual pulse animation (CSS) on the indicator dot to signal live-updating data
