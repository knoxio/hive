# CH-017: Export/Archive Room History

**As a** workspace administrator, **I want to** export and archive room chat history, **so that** I can preserve records for compliance, back up data, and analyze conversations offline.

**Complexity:** M
**Priority:** P2
**Phase:** Can Have

## Dependencies
- Room history persistence (NDJSON chat files)
- Authentication/authorization (admin-only for full export)

## Acceptance Criteria
- [ ] Export formats: JSON (structured), CSV (flat), and plain text (human-readable)
- [ ] Export scope: full room history, date range, or filtered by author/keyword
- [ ] Export includes all message types: messages, system events, commands, DMs (admin only)
- [ ] Large exports are generated asynchronously with a download link when ready
- [ ] Export file includes metadata header (room name, export date, date range, message count)
- [ ] Archive action: mark a room as archived (read-only, no new messages, preserved history)
- [ ] Archived rooms are visually distinguished in the room list (greyed out, "Archived" badge)
- [ ] Archived rooms can be unarchived by an admin
- [ ] CLI support: `room export <room> --format json --since 2026-01-01 --until 2026-03-01 > export.json`
- [ ] REST API: `POST /api/rooms/{id}/export` (returns job ID), `GET /api/exports/{job-id}` (download)
- [ ] Unit tests cover export formatting for each output format
- [ ] Integration test exports a room with 100 messages and verifies the output file is valid and complete

## Technical Notes
- Room history is already stored as NDJSON; JSON export can be a direct copy with metadata wrapper
- CSV export should flatten nested fields (e.g., `message.user`, `message.content`, `message.ts`)
- For large rooms (100K+ messages), use streaming writes to avoid memory pressure
- Consider compression (gzip) for exports over 10 MB
