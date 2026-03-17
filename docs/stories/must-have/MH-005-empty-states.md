# MH-005: Empty states with guidance (no rooms, no agents, daemon offline)

**As a** user encountering an empty or degraded Hive instance
**I want to** see contextual guidance rather than a blank panel
**So that** I know what action to take next instead of assuming the app is broken

## Complexity
S — Primarily UI work; each empty/error state is a conditional render with a short message and CTA, but requires coverage across multiple views

## Priority
P1 — Blank panels create confusion and support burden; they make the app feel unfinished and block user progress

## Dependencies
- MH-016 (List all rooms) — room list must distinguish "no rooms" from "loading" from "error"
- MH-025 (Agent list) — agent list must distinguish "no agents registered" from "all agents offline"
- MH-026 (Connection status indicator) — daemon offline state feeds into this story

## Acceptance Criteria
- [ ] Room list panel shows a "No rooms yet" empty state with a "Create your first room" CTA button when the room list is empty
- [ ] Agent panel shows a "No agents connected" empty state with documentation link when no agents are registered
- [ ] A distinct "Daemon offline" state is shown when the WebSocket connection to the daemon cannot be established, with a "Retry" button
- [ ] "Daemon offline" state displays the configured daemon URL so the user can verify it is correct
- [ ] Loading states are visually distinct from empty states (spinner vs. empty state illustration/message)
- [ ] All empty states include enough context to explain why the panel is empty and what the user should do
- [ ] Empty states are accessible — text is readable, CTAs are keyboard-focusable, and ARIA labels describe the state

## Technical Notes
- Create a reusable `EmptyState` component accepting `title`, `description`, `icon`, and optional `action` props
- Daemon offline detection should be driven by the WebSocket connection state from the connection status store (MH-026)
- Distinguish HTTP 200 with empty array (no rooms) from HTTP 503 (daemon unreachable) — render different empty states
- Avoid showing empty states during the initial load; use a skeleton or spinner for the first 300ms
