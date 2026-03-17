# CH-008: Webhook Integrations (GitHub, Slack)

**As a** team lead, **I want to** configure webhook integrations so that GitHub events (PRs, issues, CI) and Slack messages are forwarded into rooms, **so that** agents and humans have full context without switching tools.

**Complexity:** L
**Priority:** P2
**Phase:** Can Have

## Dependencies
- Room messaging API (ability to post messages programmatically)
- Webhook receiver endpoint (public-facing HTTP)
- Authentication/authorization for webhook configuration

## Acceptance Criteria
- [ ] GitHub webhook receiver accepts push, pull_request, issues, check_run, and comment events
- [ ] Slack webhook receiver accepts message and reaction events via Slack Events API
- [ ] Each webhook integration is configurable: which events to forward, which room to post to, message format template
- [ ] Webhook payloads are transformed into readable room messages (not raw JSON dumps)
- [ ] Webhook secrets are validated (GitHub HMAC signature, Slack signing secret)
- [ ] Configuration UI allows adding, editing, testing, and removing webhook integrations
- [ ] A "test webhook" button sends a sample event to verify the integration works
- [ ] Failed webhook deliveries are logged with error details and can be retried
- [ ] Rate limiting prevents webhook floods from overwhelming a room (configurable threshold)
- [ ] Outbound webhooks: room events can trigger outbound HTTP calls to external services
- [ ] REST API: `GET/POST/DELETE /api/integrations/webhooks`
- [ ] Unit tests cover payload parsing and message transformation for GitHub and Slack event types
- [ ] Integration test sends a mock GitHub PR event and verifies it appears as a room message

## Technical Notes
- Webhook receiver should be a separate HTTP path (`/webhooks/github/{room-id}`, `/webhooks/slack/{room-id}`)
- Message templates should use a simple templating language (e.g., Handlebars) for customization
- Consider a generic webhook receiver that accepts any JSON payload with configurable field mapping
- Outbound webhooks should have retry logic with exponential backoff (max 3 retries)
