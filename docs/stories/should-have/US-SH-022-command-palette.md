## User Story

As a user, I want a command palette with autocomplete when typing slash commands so that I can discover and use commands efficiently.

## Complexity
L (Large)

## Priority
P3

## Dependencies
- Message input
- Command list

## Acceptance Criteria
- [ ] Typing / in message input triggers command suggestion dropdown
- [ ] Arrow key navigation through command suggestions
- [ ] Tab key completes the selected command
- [ ] Command description shown next to each suggestion
- [ ] Parameter hints displayed after command is selected (e.g., /taskboard claim <task-id>)
- [ ] Commands sourced from builtin_command_infos and plugin registry
- [ ] Dropdown dismisses on Escape or clicking outside
- [ ] Fuzzy matching on command name as user types
