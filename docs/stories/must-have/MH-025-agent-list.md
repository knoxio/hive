# MH-025: Agent list with health status

**As a** Hive operator
**I want to** see a list of all registered agents with their current health status
**So that** I can quickly identify which agents are running, idle, or offline

## Complexity
M — Requires agent registration/discovery from the daemon, health aggregation, and real-time status updates

## Priority
P1 — Without agent visibility, operators cannot manage or debug the agent fleet; the core value proposition of Hive is compromised

## Dependencies
- MH-013 (Basic token-based auth) — agent list requires authentication
- MH-022 (Real-time receive via WebSocket) — health status must update in real time
- MH-026 (Connection status indicator) — WS connection health affects agent status freshness

## Acceptance Criteria
- [ ] An agents panel lists all agents known to the daemon with their name, type, and current status
- [ ] Each agent entry shows a colour-coded health badge: Online (green), Idle (yellow), Offline (grey), Error (red)
- [ ] Agent status updates in real time via WebSocket events — no polling or page refresh required
- [ ] Clicking an agent shows a detail view with: last seen timestamp, current room assignments, recent activity log
- [ ] If no agents are registered, the panel shows an empty state with guidance on how to connect one
- [ ] The agent list is searchable and filterable by status
- [ ] Agents that have been offline for more than 10 minutes are shown at the bottom of the list, visually dimmed

## Technical Notes
- Agent data source: query the daemon via `GET /api/rooms/*/agents` or a dedicated `/api/agents` Hive endpoint that aggregates across rooms
- Health status mapping: derive from daemon's `presence` data — connected = Online, last heartbeat > 5min = Idle, disconnected = Offline
- WebSocket events: `agent_connected`, `agent_disconnected`, `agent_status_changed`
- For the detail view, fetch recent activity from the message history filtered by sender type `agent`
- Consider polling the daemon for agent list refresh on WebSocket reconnect to avoid stale state after a disconnect
