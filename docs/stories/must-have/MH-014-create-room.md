# MH-014: Create a room

**As a** Hive member
**I want to** create a new room
**So that** I can organise conversations and agent activity around specific topics or projects

## Complexity
S — Room creation is a straightforward form + API call; complexity is in validation and propagating the new room to all connected clients

## Priority
P0 — Without room creation the application has no content surface to work with

## Dependencies
- MH-013 (Basic token-based auth) — room creation requires authentication
- MH-016 (List all rooms) — new room must appear in the room list immediately
- MH-017 (Switch between rooms) — after creation, user should be navigated to the new room

## Acceptance Criteria
- [ ] A "Create room" button is accessible from the room list panel
- [ ] Clicking the button opens a form/modal with a room name field and an optional description field
- [ ] Room name is required, 1–80 characters, and may contain alphanumerics, hyphens, and underscores only
- [ ] Submitting the form creates the room and navigates the user into it immediately
- [ ] The new room appears in the room list for all other connected users within 2 seconds (via WebSocket event)
- [ ] Attempting to create a room with a duplicate name returns a clear inline error
- [ ] The creating user is automatically added as a member and owner of the new room
- [ ] Room creation is limited to users with `member` or `admin` role (viewers cannot create rooms)

## Technical Notes
- API: `POST /api/rooms` with `{ name, description? }`; returns the created room object
- Backend must call the daemon's room creation API (`CREATE:<room_id>` or REST equivalent) to provision the room on the daemon side
- Emit a `room_created` WebSocket event to all connected clients after successful creation
- Room ID should be derived from the name (slug) but must be unique — append a short random suffix on collision
- Validate room name on both client (immediate feedback) and server (authoritative)
