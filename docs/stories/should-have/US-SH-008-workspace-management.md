## User Story

As a user, I want to organize rooms into workspaces so that I can group related rooms and switch between project contexts.

## Complexity
L (Large)

## Priority
P2

## Dependencies
- Room list
- SQLite schema

## Acceptance Criteria
- [ ] Create workspace with name and optional description
- [ ] Add/remove rooms to/from a workspace
- [ ] Switch between workspaces in the sidebar
- [ ] Delete workspace (rooms are not deleted, just ungrouped)
- [ ] Workspace settings page (rename, description, default room)
- [ ] Rooms can belong to multiple workspaces
- [ ] Default workspace for unassigned rooms
