## User Story

As a user, I want to view agent stdout/stderr in real-time from the web interface so that I can monitor agent behavior and debug issues.

## Complexity
L (Large)

## Priority
P2

## Dependencies
- Agent spawn (US-SH-004)

## Acceptance Criteria
- [ ] Log panel available per agent (expandable/collapsible)
- [ ] Logs stream in real-time via WebSocket
- [ ] Auto-scroll to bottom on new log entries (with manual scroll override)
- [ ] Log level filtering (info, warn, error)
- [ ] Clear log button (clears the view, not the source)
- [ ] Export/download log as text file
- [ ] Timestamp displayed per log line
- [ ] Handles large log volumes without UI degradation
