# CH-006: Session Replay

**As a** workspace administrator, **I want to** replay past agent conversation sessions step by step, **so that** I can review agent decision-making, debug failures, and train new team members on agent workflows.

**Complexity:** XL
**Priority:** P3
**Phase:** Can Have

## Dependencies
- Conversation/session logging infrastructure
- Agent registry
- Room history persistence

## Acceptance Criteria
- [ ] Sessions are recorded with full message history (user inputs, agent responses, tool calls, tool outputs)
- [ ] Replay UI displays messages sequentially with timestamps and sender identity
- [ ] Playback controls: play, pause, speed (1x, 2x, 5x), skip to next message, jump to timestamp
- [ ] Timeline scrubber allows jumping to any point in the session
- [ ] Tool calls and their results are displayed inline with collapsible detail views
- [ ] Search within a session by keyword or message type (tool call, error, user message)
- [ ] Sessions are listed with metadata: agent name, start/end time, duration, message count, room
- [ ] Sessions can be filtered by agent, room, date range, and status (completed, error, in-progress)
- [ ] Session data is retained for a configurable period (default: 30 days)
- [ ] Sensitive data (tokens, secrets) is redacted from replay
- [ ] Performance: sessions with up to 500 messages load within 3 seconds
- [ ] Unit tests cover session recording and retrieval logic
- [ ] Integration test verifies recording a session and replaying it produces the same message sequence

## Technical Notes
- Session recording should be append-only (NDJSON or similar) for reliability
- Consider storing sessions as a separate data stream from room chat history
- Replay is read-only; no modification of historical data
- Redaction rules should be configurable (regex patterns for secrets, API keys, tokens)
- Large sessions may need chunked loading (first 100 messages, then load more on scroll)
