## User Story

As a user, I want to create and manage API keys from the web interface so that I can authenticate external tools and scripts against Hive.

## Complexity
M (Medium)

## Priority
P2

## Dependencies
- Auth system

## Acceptance Criteria
- [ ] Dedicated API keys page accessible from settings
- [ ] Create new API key with optional label/description
- [ ] API key shown once on creation (copy-to-clipboard button)
- [ ] List all API keys with creation date, label, and last-used timestamp
- [ ] Revoke individual API keys with confirmation dialog
- [ ] Revoked keys immediately stop working for API auth
