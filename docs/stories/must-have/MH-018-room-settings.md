# MH-018: Room settings (name, description)

**As a** room owner or administrator
**I want to** edit a room's name and description
**So that** I can keep room metadata accurate as the room's purpose evolves

## Complexity
S — Standard edit form with save; must propagate changes to all connected clients in real time

## Priority
P1 — Rooms need editable metadata for discoverability and organisation; static names are a maintenance pain

## Dependencies
- MH-014 (Create a room) — rooms must exist before their settings can be edited
- MH-013 (Basic token-based auth) — settings mutations require authentication
- MH-016 (List all rooms) — room name change must be reflected in the sidebar immediately

## Acceptance Criteria
- [ ] A room settings panel is accessible via a settings icon or menu option within the room view
- [ ] Settings panel displays the current room name and description with editable fields
- [ ] Saving an updated name or description reflects the change in the room header and sidebar within 2 seconds for all connected users
- [ ] Name validation matches creation rules: 1–80 characters, alphanumerics/hyphens/underscores, unique across all rooms
- [ ] Description is optional, max 280 characters, and supports plain text only (no markdown)
- [ ] Only the room owner or an admin can access and save room settings; read-only view for other roles
- [ ] Unsaved changes trigger a "You have unsaved changes" warning if the user navigates away
- [ ] A reset button discards unsaved edits and restores the current saved values

## Technical Notes
- API: `PATCH /api/rooms/:id` with `{ name?, description? }`; returns the updated room object
- Emit a `room_updated` WebSocket event to all connected clients after successful save
- Frontend: controlled form with local state tracking dirty/clean; show Save and Reset buttons only when dirty
- If the name changes, the daemon room ID may or may not change — clarify with the backend team whether daemon rooms are renamed or if the Hive-level name and daemon-level ID are decoupled
