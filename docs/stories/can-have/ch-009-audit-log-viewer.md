# CH-009: Audit Log Viewer

**As a** workspace administrator, **I want to** view a searchable audit log of all administrative actions and security events, **so that** I can investigate incidents, satisfy compliance requirements, and track who changed what.

**Complexity:** M
**Priority:** P2
**Phase:** Can Have

## Dependencies
- Audit event logging infrastructure
- Authentication/authorization (admin-only access)

## Acceptance Criteria
- [ ] Audit log captures: user/agent CRUD, permission changes, room create/destroy, token issuance/revocation, plugin install/remove, configuration changes
- [ ] Each log entry includes: timestamp, actor (user or agent), action, target resource, result (success/failure), and IP/source
- [ ] Viewer UI displays log entries in reverse chronological order with pagination
- [ ] Filtering by actor, action type, resource, date range, and result (success/failure)
- [ ] Full-text search across log entries
- [ ] Log entries are immutable (append-only; no deletion except by retention policy)
- [ ] Retention policy is configurable (default: 90 days)
- [ ] Export audit log as CSV or JSON for external analysis
- [ ] REST API: `GET /api/audit-log` with query parameters for filtering
- [ ] Audit log is accessible only to users with admin role
- [ ] Unit tests cover log entry creation and query filtering
- [ ] Integration test verifies that a user action (e.g., room creation) produces a corresponding audit log entry

## Technical Notes
- Use an append-only storage format (NDJSON file or dedicated table) for immutability
- Index on timestamp, actor, and action type for query performance
- Consider structured logging (not free-text) so entries are machine-parseable
- Audit logging should be asynchronous to avoid adding latency to the audited operations
