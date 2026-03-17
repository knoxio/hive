# MH-016: List all rooms from daemon

**As a** Hive user
**I want to** see all available rooms in a sidebar or panel
**So that** I can navigate to the room I want to work in

## Complexity
S — Fetching a list and rendering it is simple; the real work is keeping the list in sync with daemon state via WebSocket events

## Priority
P0 — The room list is the primary navigation surface; without it users cannot access any rooms

## Dependencies
- MH-013 (Basic token-based auth) — room list is only available to authenticated users
- MH-022 (Real-time receive via WebSocket) — room create/delete events must update the list
- MH-026 (Connection status indicator) — list must handle the case where daemon is offline

## Acceptance Criteria
- [ ] On login, the room list is fetched from `GET /api/rooms` and displayed within 1 second on a typical connection
- [ ] The list shows each room's name, description (if set), and unread message count badge
- [ ] Rooms are sorted by most recent activity by default
- [ ] When a new room is created by another user, it appears in the list without a page reload
- [ ] When a room is deleted, it is removed from the list without a page reload
- [ ] The user's currently active room is visually highlighted in the list
- [ ] If the daemon is offline, the list shows the cached room list with an "Offline" indicator
- [ ] Rooms the current user is not a member of are shown in a separate "Browse" section (or hidden, depending on visibility settings)

## Technical Notes
- API: `GET /api/rooms` returns `{ rooms: Room[], total: number }`; support `?member_only=true` filter
- Cache the room list in Zustand; update it via WebSocket events (`room_created`, `room_deleted`, `room_updated`)
- Unread count: maintained per-user per-room in a `room_reads` table; increment on new message, reset on room visit
- For large deployments (100+ rooms), implement pagination or virtualised list rendering
- Room list fetch should be triggered on both initial load and WebSocket reconnect to avoid stale state
