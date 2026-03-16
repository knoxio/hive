# US-BE-028: Audit Logging

## User Story
As a platform administrator, I want an immutable audit trail of security-relevant user actions, so that I can investigate incidents, enforce compliance, and understand system usage patterns.

## Acceptance Criteria
1. The following actions are recorded in the audit log: agent spawn, agent stop, room join, room leave, workspace create, workspace update, workspace delete, API key creation, API key revocation, and login/logout events.
2. Each audit log entry contains: timestamp (UTC, millisecond precision), actor (user ID or system), action type (enum), target resource (workspace ID, room ID, agent ID as applicable), outcome (success or failure with error code), and source IP address.
3. Audit records are persisted to a dedicated `audit_log` table in the SQLite database, append-only by application convention (no UPDATE or DELETE queries issued by the application).
4. An admin endpoint `GET /api/admin/audit` supports filtering by actor, action type, target resource, and time range, with pagination (cursor-based).
5. Audit log writes never block the primary request path; entries are batched and flushed asynchronously with a maximum flush interval of 2 seconds.
6. Log entries survive application restarts (no in-memory-only buffer that could be lost on crash).
7. A retention policy is configurable in `hive.toml` (`audit_retention_days`, default 90); a background task prunes expired entries daily.
8. Integration tests verify that each auditable action produces exactly one audit record with the correct fields.

## Technical Notes
- Use a bounded async channel (e.g., `tokio::sync::mpsc` with capacity 4096) to decouple request handling from audit writes. A dedicated flush task drains the channel in batches of up to 256 entries per transaction.
- Schema: `CREATE TABLE audit_log (id INTEGER PRIMARY KEY, ts TEXT NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, target TEXT, outcome TEXT NOT NULL, ip TEXT, detail TEXT)`. The `detail` column holds optional JSON for action-specific metadata.
- Index on `(ts)` and `(actor, ts)` for efficient range queries.
- Do not log request/response bodies — only the action and its outcome. Sensitive fields (passwords, tokens) must never appear in the audit log.
- The audit writer should be injected as a shared handle (e.g., `Arc<AuditWriter>`) into route handlers, not imported as a global.

## Phase & Priority
- **Phase:** 2
- **Priority:** P2

## Dependencies
- Blocked by: US-BE-023 (SQLite persistence — audit records require the database layer), US-BE-008 (authentication — actor identity must be resolved for attribution)
- Blocks: none currently identified
- Related: US-BE-027 (rate limiting — rate limit violations may emit audit entries), US-BE-029 (workspace deletion cascade — deletion events are auditable)
