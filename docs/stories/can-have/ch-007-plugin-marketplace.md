# CH-007: Plugin Marketplace UI

**As a** workspace administrator, **I want to** browse, install, and manage plugins from a marketplace UI, **so that** I can extend Hive functionality without manual file management or CLI commands.

**Complexity:** XL
**Priority:** P3
**Phase:** Can Have

## Dependencies
- Plugin system (room-plugin architecture, dynamic loading)
- Plugin registry/index (backend catalog of available plugins)
- Authentication/authorization

## Acceptance Criteria
- [ ] Marketplace UI displays available plugins with: name, description, version, author, install count, and compatibility info
- [ ] Search and filter by category (taskboard, analytics, integrations, utilities), keyword, and compatibility
- [ ] One-click install button downloads, validates, and activates a plugin
- [ ] Installed plugins are listed with status (active, disabled, update available)
- [ ] Plugins can be enabled, disabled, updated, and uninstalled from the UI
- [ ] Plugin detail page shows: README, changelog, required permissions, and configuration options
- [ ] Plugin configuration can be edited through a form UI (generated from plugin schema)
- [ ] Version compatibility is checked before install (plugin version vs. Hive version)
- [ ] Installation progress is shown with status updates
- [ ] Plugin updates show a diff of what changed (changelog between versions)
- [ ] REST API: `GET /api/plugins/marketplace`, `POST /api/plugins/install`, `DELETE /api/plugins/{id}`
- [ ] Unit tests cover plugin compatibility checking and installation validation
- [ ] Integration test installs a test plugin from the marketplace and verifies it is loadable

## Technical Notes
- The marketplace index can start as a static JSON manifest hosted on GitHub; evolve to a dynamic registry later
- Plugin binaries must be verified (checksum or signature) before loading
- Use the existing `room plugin install/list/remove/update` CLI commands as the backend implementation
- Consider sandboxing plugins (WASM or process isolation) for security in a marketplace context
