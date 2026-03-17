# MH-020: Member list per room

**As a** room member
**I want to** see who else is in the room and their current online status
**So that** I know who is available and can address messages to the right people

## Complexity
S — Fetching and displaying a list with presence indicators; presence requires WebSocket plumbing

## Priority
P1 — Knowing who is in the room is a fundamental social affordance; without it the room feels like a void

## Dependencies
- MH-019 (Join / leave a room) — member list must reflect join/leave events
- MH-011 (User profile) — member avatars and display names come from profiles
- MH-022 (Real-time receive via WebSocket) — presence indicators require live WebSocket events

## Acceptance Criteria
- [ ] A member list panel shows all current room members with their display name and avatar/initials
- [ ] Each member shows an online/offline/idle presence indicator (green/grey/yellow dot)
- [ ] Online members are listed before offline members; within each group, sorted alphabetically
- [ ] The list updates in real time when a member joins, leaves, or changes their online status — no page reload required
- [ ] Hovering or clicking a member shows a mini profile card with their display name, username, role, and status text
- [ ] The member count is shown in the room header (e.g. "12 members, 4 online")
- [ ] Admins see a context menu on each member allowing kick or role change
- [ ] Member list is hidden or collapsed by default on narrow viewports to maximise chat space

## Technical Notes
- Presence tracking: maintain a `presence` map in the WebSocket connection layer; emit `presence_changed` events when a user connects/disconnects/idles
- Idle detection: mark a user idle after 5 minutes without a WebSocket heartbeat or message
- Member list API: `GET /api/rooms/:id/members` returns `{ members: [{ user, role, presence }] }`
- Augment with real-time updates via WebSocket `member_joined`, `member_left`, `presence_changed` events
- For large rooms (100+ members), show only online members by default with a "Show all" toggle
