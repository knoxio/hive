# US-BE-027: Room Daemon Bundling Strategy

**Phase:** 1 (Infrastructure)
**Priority:** P0 — blocks all WS/REST proxy stories

## User Story

As a **Hive server operator**, I want the room daemon to start automatically when Hive launches, so that I don't need to manage it as a separate process.

## Description

Hive bundles a room daemon instance. This story defines how hive-server starts, monitors, and stops the room daemon process. The daemon provides the real-time messaging infrastructure that all other Hive features depend on.

## Acceptance Criteria

1. hive-server starts room daemon as a child process on startup
2. Daemon socket path is configured in hive config, not hardcoded
3. hive-server waits for daemon health endpoint before accepting client connections
4. If daemon crashes, hive-server logs error and attempts restart (max 3 retries)
5. On hive-server shutdown, daemon receives SIGTERM with grace period
6. Daemon data/state dirs are co-located with Hive's data directory
7. Startup logs show daemon PID and socket path

## Technical Notes

- Use `std::process::Command` to spawn `room daemon` with configured flags
- Pass `--socket`, `--data-dir`, `--state-dir`, `--ws-port` from Hive config
- Health check via `GET /api/health` on the daemon's WS port
- Consider `--persistent` flag to prevent daemon auto-shutdown on idle

## Dependencies

- **Blocks:** US-BE-003 (WS relay), US-BE-004 (REST proxy), US-BE-001 (health)
- **Blocked by:** none (first thing to implement)
