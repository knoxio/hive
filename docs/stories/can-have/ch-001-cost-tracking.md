# CH-001: Cost Tracking Per Agent

**As a** team lead, **I want to** track token usage and model costs per agent in real time, **so that** I can identify expensive agents, optimize prompt strategies, and control cloud-compute spend.

**Complexity:** L
**Priority:** P2
**Phase:** Can Have

## Dependencies
- Agent discovery and registry (agents must be individually identifiable)
- Backend API for agent metadata
- Authentication/authorization (cost data is sensitive)

## Acceptance Criteria
- [ ] Each agent session records token counts (prompt tokens, completion tokens) per request
- [ ] Cost is calculated using a configurable model pricing table (cost per 1K tokens by model ID)
- [ ] Per-agent cost summary is available via REST API (`GET /api/agents/{id}/costs`)
- [ ] Costs are aggregatable by time range (hour, day, week, month)
- [ ] A cost breakdown view in the UI shows per-agent and per-model spend
- [ ] Historical cost data is persisted (not lost on restart)
- [ ] Admins can set a per-agent cost cap; exceeding the cap emits a warning event
- [ ] Cost data export is available as CSV or JSON
- [ ] Unit tests cover cost calculation logic for at least 3 model pricing tiers
- [ ] Integration test verifies cost accumulation across multiple agent requests

## Technical Notes
- Token counts should be captured from the LLM provider response headers/body (e.g., OpenAI `usage` field)
- Model pricing table should be a configuration file (TOML/JSON) so it can be updated without code changes
- Consider a `cost_events` table or append-only log for auditability
- Aggregation queries should use materialized views or pre-computed rollups for performance at scale
