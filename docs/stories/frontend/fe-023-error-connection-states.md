# [FE-023] Error States and Connection Recovery

**As a** user
**I want to** see clear feedback when the Hive backend is unreachable and have the connection automatically restored when it comes back
**So that** I understand why the UI is stale and do not lose context when connectivity blips occur

## Acceptance Criteria
- [ ] When the WebSocket connection drops, a persistent banner appears at the top of the app: "Connection lost. Reconnecting..." with a pulsing indicator
- [ ] The client attempts to reconnect using exponential backoff: 1s, 2s, 4s, 8s, 16s, capped at 30s
- [ ] After 5 failed reconnection attempts, the banner changes to "Unable to reach server" with a manual "Retry" button
- [ ] On successful reconnect, the banner disappears and a transient toast notification confirms "Reconnected"
- [ ] Messages sent while disconnected are queued locally (up to 50 messages) and flushed on reconnect in order
- [ ] The chat timeline shows a visual separator marking the disconnection gap (e.g., "--- connection lost at HH:MM ---")
- [ ] HTTP API errors (non-WebSocket) display inline error messages in the relevant component rather than a global banner
- [ ] Network state is exposed via a React context (`useConnectionStatus`) so any component can adapt its UI

## Phase
Phase 1 (Skeleton + Room Proxy)

## Priority
P1

## Components
- ConnectionBanner
- AppShell
- ChatTimeline
- useConnectionStatus (hook/context)

## Notes
Coordinate with r2d2 if they have a parallel story covering the same ground. This story was identified independently during architecture review. The reconnection logic should live in the WebSocket hook (FE-007) with the UI components consuming status via context. Offline message queue uses localStorage as a fallback if the tab is closed during disconnection.
