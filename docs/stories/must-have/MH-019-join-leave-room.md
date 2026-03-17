# MH-019: Join / leave a room

**As a** Hive user
**I want to** join rooms I am interested in and leave rooms that are no longer relevant to me
**So that** my room list shows only the rooms I actively participate in

## Complexity
S — Membership mutation API plus UI affordance; must update the member list and room list in real time

## Priority
P1 — Without join/leave, room membership is static after creation; users are either in all rooms or none

## Dependencies
- MH-014 (Create a room) — rooms must exist to join
- MH-016 (List all rooms) — joining a room should move it from "Browse" to "My Rooms"
- MH-020 (Member list per room) — join/leave must update the member list for all room members
- MH-013 (Basic token-based auth) — membership mutations require authentication

## Acceptance Criteria
- [ ] Users can join any non-private room from a "Browse rooms" view or by clicking an unjoined room
- [ ] Joining a room adds it to the user's room list and navigates them into it
- [ ] A "Leave room" option is accessible from the room header or settings for rooms the user is a member of
- [ ] Leaving a room removes it from the user's sidebar room list
- [ ] The member list for a room updates in real time for all members when someone joins or leaves
- [ ] Room owners cannot leave their own room until they transfer ownership or the room is deleted
- [ ] Admins can remove (kick) any member from a room via the member list
- [ ] A user who is kicked from a room loses access immediately; their active WebSocket session for that room is terminated

## Technical Notes
- API: `POST /api/rooms/:id/join`, `DELETE /api/rooms/:id/membership` (leave), `DELETE /api/rooms/:id/members/:user_id` (kick)
- Emit `member_joined` and `member_left` WebSocket events to all room members on membership changes
- For the kick flow, invalidate the kicked user's room subscription in the connection layer
- Private rooms (invite-only) are out of scope for this story — assume all rooms are public within the Hive instance for MVP
