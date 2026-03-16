# US-BE-032: Agent memory file sync to Hive DB

**As a** platform operator
**I want to** periodically sync agent memory files from disk into the Hive database
**So that** agent memory persists across server restarts, host migrations, and agent re-provisioning

## Acceptance Criteria
- [ ] A background task runs on a configurable interval (default: 5 minutes, configurable via `memory_sync_interval_secs` in `hive.toml`) and syncs agent memory files to SQLite
- [ ] Memory files are read from each agent's `~/.claude/projects/<project>/memory/` directory
- [ ] Each file is stored as a row in an `agent_memory` table: `(agent_id, file_path, content, sha256, synced_at)`
- [ ] Only files whose SHA-256 hash has changed since the last sync are written to the DB (delta sync)
- [ ] On agent spawn (US-BE-012), if memory rows exist in the DB for that agent, they are restored to the filesystem before the agent process starts
- [ ] Deleted memory files on disk result in a soft-delete in the DB (`deleted_at` timestamp) rather than hard removal
- [ ] `GET /api/agents/:agent_id/memory` returns the list of synced memory files with metadata (path, size, last synced)
- [ ] Memory sync errors (permission denied, disk full) are logged at `WARN` level and do not crash the background task
- [ ] The sync task is gracefully stopped during server shutdown (US-BE-026/US-BE-027)

## Technical Notes
- Implement the sync loop in `crates/hive-server/src/memory_sync.rs`
- Use `tokio::time::interval` for the periodic trigger; spawn as a background task in the server's main function
- SHA-256 via the `sha2` crate (already in the Rust ecosystem, no C dependencies)
- The `agent_memory` table schema: `CREATE TABLE agent_memory (id INTEGER PRIMARY KEY, agent_id TEXT NOT NULL, file_path TEXT NOT NULL, content BLOB NOT NULL, sha256 TEXT NOT NULL, synced_at TEXT NOT NULL, deleted_at TEXT, UNIQUE(agent_id, file_path))`
- On restore, write files with the same relative paths under the agent's memory directory; create intermediate directories as needed
- Consider compressing large memory files (>100KB) with zstd before storing in SQLite to reduce DB size

## Phase
Phase 3 (Teams + Orchestration)
