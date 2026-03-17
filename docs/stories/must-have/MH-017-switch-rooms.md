# MH-017: Switch between rooms

**As a** Hive user
**I want to** switch between rooms by clicking on them in the room list
**So that** I can participate in multiple conversations without opening new windows

## Complexity
S — Navigation action with state management; URL-based room routing ensures deep links work and back/forward navigation is preserved

## Priority
P0 — Single-room navigation is the core interaction loop; without it the app is a static view

## Dependencies
- MH-016 (List all rooms) — must have a room list to switch between
- MH-023 (Message history with scroll-back) — each room view must load its history on switch
- MH-024 (Auto-scroll to latest message) — switching rooms should scroll to the latest message

## Acceptance Criteria
- [ ] Clicking a room in the sidebar navigates to that room's chat view
- [ ] The active room is reflected in the URL (e.g. `/rooms/:room_id`) so the view is deep-linkable
- [ ] Navigating to a room URL directly (e.g. after copy-pasting) loads the correct room
- [ ] Switching rooms loads message history for the new room and scrolls to the latest message
- [ ] The previously active room's scroll position is preserved — returning to it restores the position
- [ ] Unread badge on the room list item is cleared when the user enters a room
- [ ] Back/forward browser navigation moves between previously visited rooms
- [ ] Switching rooms is instant (optimistic navigation); message history loads asynchronously with a skeleton

## Technical Notes
- Route pattern: `/rooms/:roomId` — use React Router's `useParams` to extract the room ID
- On room switch, update the "last read" cursor: `POST /api/rooms/:id/read` to clear the unread count
- Preserve per-room scroll position in a `Map<roomId, scrollTop>` in the Zustand store — restore it when re-entering
- Pre-fetch the target room's message history on hover (optional optimisation) using a short debounce
- Do not unmount the message list component on room switch — keep it mounted but hidden to preserve scroll state; conditionally render based on active room
