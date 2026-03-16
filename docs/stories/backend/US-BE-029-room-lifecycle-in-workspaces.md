# US-BE-029: Room lifecycle within workspaces

**As a** workspace admin
**I want to** create and delete rooms within a workspace via the API
**So that** I can manage room topology without SSH-ing into the server or using the CLI directly

## Acceptance Criteria
- [ ] `POST /api/workspaces/:workspace_id/rooms` creates a new room within the workspace; request body: `{ "room_id": "<name>" }`; returns `201 Created` with the room object
- [ ] `DELETE /api/workspaces/:workspace_id/rooms/:room_id` destroys the room, disconnecting all clients and stopping all agents assigned to it; returns `204 No Content`
- [ ] Room IDs are validated against the same naming rules as the room CLI (`validate_room_id`): alphanumeric + hyphens, 1-64 chars, no leading hyphen
- [ ] Creating a room that already exists returns `409 Conflict`
- [ ] Deleting a room that does not exist returns `404 Not Found`
- [ ] Room creation starts the room daemon process and registers it in the workspace's room list
- [ ] Room deletion sends a clean shutdown signal to the daemon before removing it from the workspace
- [ ] Both endpoints require a valid session token with admin permissions on the target workspace
- [ ] Room list endpoint (`GET /api/workspaces/:workspace_id/rooms`) returns all rooms in the workspace with their status (running/stopped)

## Technical Notes
- Implement handlers in `crates/hive-server/src/routes/workspaces.rs` (or a nested `rooms.rs` module)
- Room creation should invoke the same daemon spawn logic used by `room daemon --room <name>`, adapted for programmatic use
- Room deletion should use the `DESTROY:<room_id>` protocol if connected to a running daemon, or clean up the socket/meta files directly if the daemon is unresponsive
- Store room-to-workspace mapping in SQLite (`rooms` table with a `workspace_id` foreign key)
- Workspace admin check: validate the session user has the `admin` role for the target workspace

## Phase
Phase 3 (Teams + Orchestration)
