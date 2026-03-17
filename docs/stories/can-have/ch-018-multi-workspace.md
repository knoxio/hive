# CH-018: Multi-Workspace/Multi-Daemon Support

**As a** platform operator, **I want to** manage multiple workspaces (each with its own daemon, rooms, and agents) from a single Hive instance, **so that** I can support multiple teams or projects with isolated environments.

**Complexity:** XL
**Priority:** P3
**Phase:** Can Have

## Dependencies
- Workspace management (core workspace CRUD)
- Daemon lifecycle management
- Authentication/authorization with workspace-scoped permissions

## Acceptance Criteria
- [ ] A Hive instance can host multiple workspaces, each with independent rooms, agents, and configuration
- [ ] Workspace switcher in the UI allows navigating between workspaces
- [ ] Each workspace has its own daemon process (or isolated daemon context within a shared process)
- [ ] User accounts can belong to multiple workspaces with per-workspace roles
- [ ] Workspace isolation: agents in workspace A cannot access rooms in workspace B
- [ ] Workspace creation and deletion via admin UI and CLI
- [ ] Workspace-level configuration: default agent model, rate limits, storage quota
- [ ] Cross-workspace search for admin users (find a user or agent across all workspaces)
- [ ] Workspace health status in the admin dashboard (daemon up/down, agent count, message rate)
- [ ] REST API: `GET/POST/DELETE /api/workspaces`, `GET /api/workspaces/{id}/status`
- [ ] Data migration tool: move a room from one workspace to another
- [ ] Unit tests cover workspace isolation (agent in workspace A cannot join room in workspace B)
- [ ] Integration test creates 2 workspaces, spawns an agent in each, and verifies isolation

## Technical Notes
- Each workspace maps to a separate daemon instance (using room's existing multi-room daemon)
- Workspace isolation is enforced at the API gateway level (workspace ID in URL path prefix)
- Consider namespace prefixing for room IDs to prevent collisions across workspaces
- User-workspace membership should be stored in the user registry (many-to-many relationship)
- Start with a fixed maximum of 10 workspaces per instance; make configurable later
