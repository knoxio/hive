# MH-015: Delete a room

**As a** Hive administrator or room owner
**I want to** delete a room
**So that** unused or obsolete rooms don't clutter the interface

## Complexity
S — Simple API call with confirmation dialog; the main risk is accidental deletion and cleanup of dependent data

## Priority
P1 — Not blocking for initial use but essential for lifecycle management; a room list that can only grow is a maintenance problem

## Dependencies
- MH-013 (Basic token-based auth) — deletion requires authentication and role check
- MH-014 (Create a room) — rooms must exist before they can be deleted
- MH-016 (List all rooms) — deleted room must disappear from the list for all users

## Acceptance Criteria
- [ ] Delete option is accessible from the room settings or a context menu on the room list item
- [ ] Clicking delete shows a confirmation dialog that requires the user to type the room name to proceed
- [ ] Confirming deletion removes the room and navigates all current members out of it
- [ ] The deleted room disappears from the room list for all connected users within 2 seconds (via WebSocket event)
- [ ] Only admins or the room owner can delete a room; the delete action is hidden or disabled for other roles
- [ ] Deleting a room destroys the room on the daemon side as well (sends `DESTROY:<room_id>` or REST equivalent)
- [ ] Attempting to delete a non-existent room (e.g. race condition) returns a graceful 404 error, not a crash
- [ ] Message history for the deleted room is retained in the Hive database for audit purposes but no longer browsable

## Technical Notes
- API: `DELETE /api/rooms/:id`; returns 204 on success
- Backend must call the daemon's room destruction API after removing the room from Hive's DB
- Emit a `room_deleted` WebSocket event to all connected clients; clients subscribed to that room should navigate away
- Soft-delete pattern: set `deleted_at` timestamp rather than removing the row; this preserves message history and avoids FK constraint issues
- Consider a grace period (e.g. 30 seconds) during which deletion can be undone — optional, out of scope for MVP
