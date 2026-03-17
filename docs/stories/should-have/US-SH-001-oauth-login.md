## User Story

As a user, I want to log in using my GitHub account so that I don't need to create a separate set of credentials for Hive.

## Complexity
L (Large)

## Priority
P1

## Dependencies
- Basic auth (#61)

## Acceptance Criteria
- [ ] GitHub OAuth button visible on login page
- [ ] OAuth callback endpoint handles GitHub redirect
- [ ] Token exchange completes securely (authorization code -> access token)
- [ ] Session is created after successful OAuth flow
- [ ] User profile (username, avatar) is populated from GitHub
- [ ] Handles OAuth errors gracefully (denied, expired, network failure)
- [ ] Works alongside existing basic auth (users can choose either method)
