# US-BE-031: Global Search

## User Story
As a user, I want to search across messages and tasks in all workspaces I have access to, so that I can quickly find conversations, decisions, and task references without manually checking each room.

## Acceptance Criteria
1. A `GET /api/search` endpoint accepts a query string parameter `q` and returns matching messages and tasks ranked by relevance.
2. Search results are scoped to workspaces and rooms the authenticated user has access to; results from private rooms or workspaces the user is not a member of are excluded.
3. The endpoint supports filtering by: resource type (`messages`, `tasks`, or both), workspace ID, room ID, author, and date range (`from` / `to` as ISO 8601 timestamps).
4. Results are paginated with cursor-based pagination; each page returns up to 50 results by default (configurable via `limit` parameter, max 200).
5. Search matches on message content and task descriptions using SQLite FTS5 full-text search; partial word matching (prefix search) is supported via the `*` suffix operator.
6. Each result includes: resource type, resource ID, matched snippet (with highlighted match boundaries using `<mark>` tags), room ID, workspace ID, author, and timestamp.
7. Search indexing does not block message ingestion; new messages and tasks are indexed asynchronously with a maximum lag of 5 seconds under normal load.
8. Integration tests verify: access-scoped results (user A does not see user B's private room messages), FTS ranking, pagination cursor correctness, filter combinations, and prefix matching.

## Technical Notes
- Use SQLite FTS5 virtual tables for full-text indexing. Create `messages_fts` and `tasks_fts` tables that mirror the content columns of the underlying tables. Triggers or an async indexer keep them in sync.
- FTS5 snippet function (`snippet(messages_fts, 0, '<mark>', '</mark>', '...', 32)`) provides match highlighting natively.
- Ranking: use FTS5's built-in `bm25()` ranking function. Weight message content higher than task descriptions if both are returned in a combined query.
- Access control: join the FTS results against the user's workspace/room membership tables in the query itself (single SQL query, not post-filter) to avoid leaking result counts.
- Index maintenance: use `INSERT INTO messages_fts(messages_fts) VALUES('rebuild')` as a maintenance command, exposed via an admin endpoint for manual re-indexing.
- Consider a configurable `search.max_indexing_lag_secs` in `hive.toml` (default 5) that controls how frequently the async indexer flushes.

## Phase & Priority
- **Phase:** 3
- **Priority:** P2

## Dependencies
- Blocked by: US-BE-023 (SQLite persistence — FTS5 virtual tables require the database layer), US-BE-017 (workspaces — workspace membership is needed for access-scoped results)
- Blocks: none currently identified
- Related: US-BE-008 (authentication — caller identity determines result visibility), US-BE-030 (WS permission filtering — shares the concept of per-user visibility scoping)
