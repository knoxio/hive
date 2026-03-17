# CH-010: Rate Limiting Dashboard

**As a** workspace administrator, **I want to** view and configure rate limits for agents and API endpoints from a dashboard, **so that** I can prevent runaway agents from exhausting resources and ensure fair usage across the team.

**Complexity:** M
**Priority:** P3
**Phase:** Can Have

## Dependencies
- Rate limiting middleware (backend)
- Agent registry
- Authentication/authorization

## Acceptance Criteria
- [ ] Dashboard displays current rate limit configuration for each agent and API endpoint
- [ ] Dashboard shows real-time usage against limits (e.g., "42/100 requests this minute")
- [ ] Rate limits are configurable per agent, per endpoint, and globally (requests/minute, tokens/hour)
- [ ] Visual indicators (green/yellow/red) show how close each agent is to its limit
- [ ] Historical rate limit hit/miss data is displayed as a chart over time
- [ ] Alerts are shown when an agent is throttled (with details: which limit, when, how many requests dropped)
- [ ] Admin can temporarily override limits for a specific agent (e.g., during a sprint)
- [ ] Changes to rate limits take effect immediately without restart
- [ ] REST API: `GET/PUT /api/rate-limits`, `GET /api/rate-limits/usage`
- [ ] Unit tests cover rate limit calculation and threshold detection
- [ ] Integration test verifies that exceeding a rate limit produces a 429 response and dashboard reflects it

## Technical Notes
- Use a token bucket or sliding window algorithm for rate limiting
- Rate limit state should be in-memory (Redis or local) for low-latency checks
- Configuration changes should be persisted to survive restarts
- Consider burst allowances (e.g., 10 requests/second sustained, 50/second burst)
