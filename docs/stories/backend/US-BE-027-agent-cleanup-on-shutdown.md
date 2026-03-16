# US-BE-027: Agent process cleanup on server shutdown

**As a** platform operator
**I want to** have all spawned room-ralph processes killed, waited on, and logged during server shutdown
**So that** no orphan agent processes remain after the Hive server exits

## Acceptance Criteria
- [ ] On SIGTERM/SIGINT, the shutdown handler iterates all running agents in the `AgentRegistry` and sends SIGTERM to each room-ralph process
- [ ] Each agent process is given up to `agent_stop_timeout_secs` (default 10s, configurable in `hive.toml`) to exit before receiving SIGKILL
- [ ] The server waits for all agent processes to fully exit (via `waitpid` or equivalent) before proceeding with the rest of shutdown
- [ ] Final status of each agent is logged at `INFO` level: agent name, PID, exit code or signal, and total runtime
- [ ] Agents that fail to exit after SIGKILL are logged at `ERROR` level with their PID for manual investigation
- [ ] The cleanup runs after HTTP/WS connection draining (US-BE-026) but before SQLite checkpoint
- [ ] If no agents are running, the cleanup step is a no-op and logs "no agents to clean up" at `DEBUG` level

## Technical Notes
- Extend the shutdown sequence in `crates/hive-server/src/main.rs` to insert agent cleanup between connection drain and DB checkpoint
- Reuse the SIGTERM + wait + SIGKILL logic from US-BE-013 (`agent_stop`); extract it into a shared helper if not already done
- Use `tokio::process::Child::wait()` with `tokio::time::timeout` for the wait phase
- Log via `tracing::info!` / `tracing::error!` with structured fields: `agent_name`, `pid`, `exit_code`, `runtime_secs`
- Consider running agent shutdowns concurrently (all get SIGTERM at once, then await all) rather than sequentially to minimize total shutdown time

## Phase
Cross-cutting
