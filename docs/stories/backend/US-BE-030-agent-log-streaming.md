# US-BE-030: Real-time agent log streaming via WebSocket

**As a** workspace admin or developer
**I want to** tail an agent's logs in real time via a WebSocket connection
**So that** I can monitor agent behavior without SSH access or terminal-based log viewers

## Acceptance Criteria
- [ ] `GET /ws/agents/:agent_id/logs` upgrades to a WebSocket connection and streams log lines as text frames
- [ ] The stream starts from the current tail position (no history replay by default)
- [ ] An optional query parameter `?lines=N` replays the last N lines before switching to live streaming (default: 0, max: 1000)
- [ ] Each text frame contains a single log line (newline-delimited in the source file)
- [ ] When the agent stops or its log file is rotated, the WebSocket sends a final status frame `{"type":"eof","reason":"agent_stopped"}` and closes cleanly
- [ ] If the agent does not exist or has no log file, the endpoint returns `404` before upgrading
- [ ] The endpoint requires a valid session token; the user must have read access to the agent's workspace
- [ ] Multiple concurrent log stream connections to the same agent are supported

## Technical Notes
- Implement in `crates/hive-server/src/ws_logs.rs`
- Use `tokio::fs::File` + `tokio::io::BufReader` with `seek(SeekFrom::End)` for tail-follow behavior
- Poll the file for new data using `tokio::time::interval` (e.g., 200ms) or `inotify`/`kqueue` via `notify` crate for event-driven tailing
- Agent log paths are resolved from the `AgentRegistry` which tracks each agent's log file location
- Backpressure: if the client is slow to read, buffer up to 1000 lines before dropping oldest undelivered lines and sending a `{"type":"dropped","count":N}` notification
- Consider a shared broadcast channel per agent to avoid multiple file readers when several clients tail the same agent

## Phase
Phase 2 (Interactive Features)
