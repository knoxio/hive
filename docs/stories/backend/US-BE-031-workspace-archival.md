# US-BE-031: Workspace archival

**As a** workspace admin
**I want to** archive a workspace instead of deleting it
**So that** agents are stopped to free resources but all chat history, task boards, and configuration are preserved for future reference

## Acceptance Criteria
- [ ] `POST /api/workspaces/:workspace_id/archive` transitions a workspace to `archived` status; returns `200 OK` with the updated workspace object
- [ ] `POST /api/workspaces/:workspace_id/unarchive` restores an archived workspace to `active` status; returns `200 OK`
- [ ] Archiving a workspace stops all running agents in the workspace (via the same logic as US-BE-013)
- [ ] Archiving a workspace stops all room daemons in the workspace
- [ ] Archived workspaces retain all data: chat history files, task board entries, agent memory files, configuration
- [ ] Archived workspaces are excluded from `GET /api/workspaces` by default; include them with `?include_archived=true`
- [ ] Attempting to spawn an agent or create a room in an archived workspace returns `409 Conflict` with error message "workspace is archived"
- [ ] Unarchiving a workspace restarts room daemons but does not auto-restart agents; agents must be spawned explicitly
- [ ] Both endpoints require admin permissions on the target workspace
- [ ] Deleting an archived workspace permanently removes all data and requires explicit confirmation (`?confirm=true` query param)

## Technical Notes
- Add an `archived_at` nullable timestamp column to the `workspaces` table in SQLite; `NULL` means active, non-null means archived
- Implement handlers in `crates/hive-server/src/routes/workspaces.rs`
- Archive operation: set `archived_at = NOW()`, then iterate agents and rooms for shutdown
- Unarchive operation: set `archived_at = NULL`, then restart room daemons from the workspace config
- The workspace data directory on disk is left untouched during archival; only the DB status and running processes change
- Consider adding a `status` field to the workspace API response: `"active"` or `"archived"`

## Phase
Phase 3 (Teams + Orchestration)
