# CH-005: Agent Memory/Knowledge Viewer

**As a** workspace administrator, **I want to** browse and search an agent's accumulated memory and knowledge base, **so that** I can understand what context an agent is working with, debug unexpected behavior, and prune stale knowledge.

**Complexity:** L
**Priority:** P3
**Phase:** Can Have

## Dependencies
- Agent memory/knowledge persistence system
- Agent registry
- Authentication/authorization

## Acceptance Criteria
- [ ] Viewer displays all memory entries for a selected agent, sorted by recency
- [ ] Each memory entry shows: source (conversation, file read, user instruction), timestamp, content preview, and tags
- [ ] Full-text search across an agent's memory entries returns results within 500ms for up to 10K entries
- [ ] Filtering by memory type (permanent, session, auto-generated) and date range is supported
- [ ] Admin can delete individual memory entries or bulk-delete by filter
- [ ] Admin can mark memory entries as "pinned" (immune to automatic pruning)
- [ ] Memory viewer shows total memory size and count per category
- [ ] Changes to memory are logged in the audit trail
- [ ] REST API: `GET /api/agents/{id}/memory`, `DELETE /api/agents/{id}/memory/{entry-id}`
- [ ] Read-only mode for non-admin users (view but not modify)
- [ ] Unit tests cover memory listing, filtering, and deletion logic
- [ ] Integration test verifies memory CRUD lifecycle

## Technical Notes
- Memory entries correspond to the agent memory convention in CLAUDE.md (MEMORY.md, topic files, progress files)
- The viewer should parse and render Markdown content
- Consider lazy-loading or pagination for agents with large memory stores
- Deletion should be soft-delete with a retention period before permanent removal
