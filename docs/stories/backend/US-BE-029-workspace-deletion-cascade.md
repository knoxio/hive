# US-BE-029: Workspace Deletion Cascade

## User Story
As a workspace owner, I want deleting a workspace to cleanly stop all running agents, remove workspace files, and cascade-delete all associated database records, so that no orphaned resources or stale state remain after deletion.

## Acceptance Criteria
1. When a workspace is deleted via `DELETE /api/workspaces/:id`, all agents currently running in that workspace receive a graceful shutdown signal (SIGTERM) with a 10-second timeout before SIGKILL.
2. Agent processes that do not exit within the timeout are force-killed, and their PIDs are cleaned up from the process table tracking.
3. All room broker instances associated with the workspace are shut down and their Unix domain sockets are removed from the filesystem.
4. The workspace data directory (chat logs, token files, cursor files) is recursively deleted from disk.
5. Database records cascade: workspace row, associated agent records, room records, task entries, and any workspace-scoped configuration are deleted in a single transaction.
6. The deletion endpoint returns 202 Accepted immediately and performs cleanup asynchronously; a subsequent `GET /api/workspaces/:id` returns 404 once cleanup completes, or 409 Conflict if cleanup is still in progress.
7. If any cleanup step fails (e.g., filesystem permission error), the workspace is marked as `deletion_failed` with an error message retrievable via the API, rather than being silently left in a half-deleted state.
8. Integration tests verify the full cascade: spawn agents, create rooms, populate data, delete workspace, then assert all resources are gone and all processes are stopped.

## Technical Notes
- Implement as a state machine: `Active -> Deleting -> Deleted` (or `DeletionFailed`). The `Deleting` state prevents new agent spawns or room creation in the workspace.
- Use `PRAGMA foreign_keys = ON` and `ON DELETE CASCADE` on foreign key constraints where possible, but still perform explicit agent shutdown before issuing the SQL delete (foreign keys handle the DB side; application code handles the OS side).
- Filesystem cleanup should use `tokio::task::spawn_blocking` with `std::fs::remove_dir_all` — do not use `tokio::fs` (cancellation-unsafe, per project invariants).
- Consider emitting an audit event (US-BE-028) for each sub-step of the cascade to aid debugging if partial failures occur.
- The 10-second SIGTERM timeout should be configurable in `hive.toml` (`workspace.shutdown_timeout_secs`).

## Phase & Priority
- **Phase:** 3
- **Priority:** P1

## Dependencies
- Blocked by: US-BE-017 (workspace CRUD — the workspace must exist and have standard lifecycle endpoints), US-BE-012 (agent spawn/stop — agent process management primitives must be in place)
- Blocks: none currently identified
- Related: US-BE-028 (audit logging — deletion events should be audited), US-BE-023 (SQLite — cascade relies on the database schema and foreign keys)
