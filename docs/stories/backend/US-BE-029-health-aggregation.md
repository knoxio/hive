# US-BE-029: Health Check Aggregation

**Phase:** 1 (Infrastructure)
**Priority:** P1

## User Story

As a **Hive operator**, I want a single health endpoint that shows the status of all system components, so that I can monitor the entire stack from one place.

## Description

Hive's health endpoint should aggregate health from three sources: the Hive server itself, the bundled room daemon, and spawned agents. This gives operators (and the frontend status bar) a unified view of system health.

## Acceptance Criteria

1. `GET /api/health` returns aggregated status: `ok`, `degraded`, or `down`
2. Response includes component-level health:
   - `hive`: server uptime, memory usage
   - `room`: daemon status (ok/unreachable), connected users count, active rooms
   - `agents`: total spawned, healthy count, stale count, exited count
3. Overall status is `ok` only when all components are healthy
4. Status is `degraded` if agents are stale but room is up
5. Status is `down` if room daemon is unreachable
6. Response time < 100ms (cached, not live-queried on every request)
7. Frontend status bar consumes this endpoint (FE-001 app shell)

## Technical Notes

- Room health via `GET /api/health` on daemon WS port (already exists)
- Agent health via `/agent list` command data field (already has health column)
- Cache aggregated result for 10s to avoid hammering daemon on every frontend poll
- Consider SSE or WS push for real-time health updates (stretch)

## Dependencies

- **Blocks:** FE-001 (app shell status bar)
- **Blocked by:** US-BE-027 (daemon bundling), US-BE-001 (basic health)
