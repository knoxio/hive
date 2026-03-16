# [FE-023] Error States and Connection Lost Handling

**As a** Hive user
**I want to** see clear error indicators when the backend is unreachable or connections drop
**So that** I understand the system state and can take corrective action instead of staring at stale data

## Acceptance Criteria
- [ ] A connection-lost banner appears at the top of the UI within 5 seconds of WebSocket disconnection, showing "Connection lost — reconnecting..." with a spinner
- [ ] The banner upgrades to "Connection lost — click to retry" after 3 failed reconnection attempts (exponential backoff: 1s, 2s, 4s)
- [ ] When reconnected, the banner shows "Reconnected" briefly (2s) then disappears; missed messages are fetched via REST poll to fill the gap
- [ ] API errors (4xx, 5xx) show inline error toasts with the error message, auto-dismiss after 5 seconds
- [ ] Agent spawn failures show a modal with the error detail and a "Retry" button
- [ ] Stale data indicators: if the last WS message is >30 seconds old, a subtle "Data may be stale" badge appears in the status bar
- [ ] Network-offline detection (navigator.onLine) shows a distinct "No internet connection" banner
- [ ] All error states are accessible: ARIA live regions announce connection changes to screen readers

## Phase
Phase 2: Interactive Features (but connection banner should ship in Phase 1 MVP)

## Priority
P1 (connection banner is P0)

## Components
- ConnectionBanner
- ErrorToast
- StaleDataBadge

## Dependencies
- FE-007 (WebSocket Connection Management) — must be implemented first

## Notes
Connection lost handling is the most common error state in real-time apps. The reconnection logic should live in the WS connection manager (FE-007) and expose state that this component observes. The stale data badge prevents users from trusting outdated agent/task status after silent disconnects.
