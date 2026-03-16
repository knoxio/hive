# US-BE-027: API rate limiting

**As a** platform operator
**I want to** rate-limit API requests per user
**So that** no single user can overwhelm the server or spawn excessive agents

## Acceptance Criteria
- [ ] All authenticated endpoints enforce per-user rate limits
- [ ] Agent spawn (POST /api/agents) limited to 5 requests per minute per user
- [ ] Message send (POST /api/rooms/:id/send) limited to 60 requests per minute per user
- [ ] Other endpoints limited to 120 requests per minute per user
- [ ] Rate-limited requests return 429 Too Many Requests with Retry-After header
- [ ] Rate limit state is in-memory (no external store needed for single-host)
- [ ] Unauthenticated endpoints (/health, /login) exempt from per-user limits but have global IP-based limits

## Dependencies
- US-BE-009 (session management — need user identity for per-user limits)

## Technical Notes
- Use tower::limit::RateLimit or a custom middleware with governor crate
- Store rate limit buckets in DashMap<UserId, RateLimiter> on AppState
- Agent spawn has the strictest limit because each spawn creates a process
- Consider burst allowance (token bucket with 5 burst, 1/12s refill for spawn)
- Log rate-limited requests at WARN level

## Phase
Phase 2 (Auth + Agent Management)
