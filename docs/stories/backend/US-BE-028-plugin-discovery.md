# US-BE-028: Plugin Discovery

**Phase:** 2 (Auth & Agents)
**Priority:** P1

## User Story

As a **Hive frontend developer**, I want to query which plugins are available in the room daemon, so that I can show available commands and features in the UI.

## Description

Hive needs to know what plugins are loaded by the room daemon (taskboard, queue, stats, agent, and any dynamic plugins). This enables the frontend to show available slash commands, render plugin-specific UI (task boards, queues), and hide features for plugins that aren't installed.

## Acceptance Criteria

1. Hive server exposes `GET /api/plugins` returning a list of loaded plugins
2. Each plugin entry includes: name, version, commands (name + description + params)
3. Response includes both builtin and dynamically-loaded plugins
4. Frontend can use this to populate command palette and feature toggles
5. Endpoint is cached (plugins don't change at runtime) with 5-min TTL
6. Returns empty list gracefully if daemon is unreachable

## Technical Notes

- Room daemon already has `room plugin list` CLI command and `/info` slash command
- Hive can query via REST: `GET /api/<room>/send` with `/info` command, or parse the builtin command infos
- Alternative: add a dedicated `/api/plugins` endpoint to room daemon (cleaner)
- Plugin commands drive the frontend command palette (FE-014)

## Dependencies

- **Blocks:** FE-014 (command palette), FE-008 (spawn wizard — needs personality list)
- **Blocked by:** US-BE-027 (daemon bundling), US-BE-003 (WS relay)
