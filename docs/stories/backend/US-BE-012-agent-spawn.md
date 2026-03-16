# US-BE-012: Agent spawn

**As a** workspace owner
**I want to** spawn an AI agent with a specific personality, model, and room assignment
**So that** the agent joins the room and begins working autonomously

## Acceptance Criteria
- [ ] `POST /api/agents` with body `{"room_id": "...", "personality": "...", "model": "sonnet|opus|haiku", "workspace_id": "..."}` spawns a `room-ralph` process and returns `{"agent_id": "<uuid>", "status": "starting", "pid": N}`
- [ ] The spawned `room-ralph` process has its own working directory under `config.data_dir/agents/<agent_id>/`
- [ ] `personality` is a string passed as `--personality` to `room-ralph`; invalid personalities return `400 Bad Request`
- [ ] `model` defaults to `sonnet` if absent
- [ ] Agent record is created in SQLite with status `starting`; status transitions to `running` once the process is confirmed alive
- [ ] Returns `409 Conflict` if an agent with the same `username` is already running in the same room (multiple agents with the same personality are allowed — e.g. coder-anna and coder-kai are both "coder")
- [ ] Maximum concurrent agents per workspace is enforced (`max_agents_per_workspace` in config, default 10)
- [ ] Agent username is auto-generated from `<personality>-<name>` where name is picked from the personality's name pool
- [ ] Spawn failure (process exits within 5s) transitions status to `failed` with error message

## Dependencies
- US-BE-011 (token mapping — agents need room tokens)
- US-BE-016 (workspace provisioning — agents need workdirs)

## Technical Notes
- Implement in `crates/hive-server/src/agents.rs`
- Use `tokio::process::Command` to spawn `room-ralph`; store the `Child` handle in an in-memory `AgentRegistry` (`DashMap<Uuid, AgentHandle>`)
- `AgentHandle` stores: `pid`, `room_id`, `personality`, `model`, `start_time`, `log_file_path`, `child: tokio::process::Child`
- `room-ralph` is found via `config.ralph_binary_path` or `PATH`
- Stdout/stderr of the child process is redirected to `config.data_dir/agents/<agent_id>/agent.log`
- A background task monitors the child's exit status and updates the SQLite status to `stopped` on exit

## Clarifications (Sprint 19 Review)

- **Spawn failure handling**: Return `500 Internal Server Error` with a JSON body `{"error": "<detail>"}` in the following cases:
  - `room-ralph` binary not found at `config.ralph_binary_path` or on `PATH`
  - Agent working directory creation fails (e.g., permission denied, disk full)
  - Spawned process does not become alive (PID check) within 10 seconds of `Command::spawn()`
  In all cases, clean up any partially-created resources (directory, SQLite record) before returning.
- **Duplicate check**: Reject with `409 Conflict` if an agent with the same **username** (not personality) is already running in the same room. Multiple agents with the same personality but different usernames are allowed in the same room (e.g., two `coder` agents). The existing AC for personality-based conflict detection (same personality in same room) is superseded by this username-based check.
- **Process monitoring**: A background task checks each agent's PID every 30 seconds using a kill-zero probe (`kill(pid, 0)`). If the process is dead, update the SQLite status to `"exited"` and record the exit code if available from the stored `Child` handle. Emit an info-level log entry with the agent ID, room ID, and exit code.
- **Personality validation**: The `personality` parameter must match the name of an installed personality file. Validate against the set of available personalities at spawn time. Return `400 Bad Request` with `{"error": "unknown personality: <name>"}` if no matching personality is found.

## Phase
Phase 2 (Auth + Agent Management)
