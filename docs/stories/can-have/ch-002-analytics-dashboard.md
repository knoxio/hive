# CH-002: Analytics Dashboard

**As a** workspace administrator, **I want to** view analytics on message volume, agent uptime, and task completion rates, **so that** I can measure team productivity and identify bottlenecks.

**Complexity:** XL
**Priority:** P2
**Phase:** Can Have

## Dependencies
- Backend metrics collection infrastructure
- Agent registry with uptime tracking
- Taskboard plugin (for task completion data)
- Authentication/authorization

## Acceptance Criteria
- [ ] Dashboard displays message volume over time (per room, per agent, total)
- [ ] Dashboard displays agent uptime percentage (online vs. offline time)
- [ ] Dashboard displays task completion metrics (completed, cancelled, average time-to-complete)
- [ ] Time range selector allows filtering by last 1h, 6h, 24h, 7d, 30d, and custom range
- [ ] Charts are interactive (hover for detail, click to drill down)
- [ ] Data refreshes automatically at a configurable interval (default: 30s)
- [ ] Dashboard is accessible only to authenticated users with admin or viewer role
- [ ] API endpoints exist for all dashboard data (`GET /api/analytics/messages`, `/agents`, `/tasks`)
- [ ] Empty states are handled gracefully (no data yet, no agents online)
- [ ] Performance: dashboard loads within 2 seconds for workspaces with up to 100 agents and 1M messages
- [ ] Unit tests cover metric aggregation logic
- [ ] Integration test verifies end-to-end data flow from event to dashboard API response

## Technical Notes
- Use time-series bucketing for message volume (minute/hour/day granularity depending on range)
- Agent uptime can be derived from heartbeat events or session connect/disconnect logs
- Task metrics come from taskboard plugin events (TaskPosted, TaskClaimed, TaskFinished, TaskCancelled)
- Consider using a lightweight charting library (e.g., recharts, visx) for the React frontend
- Pre-aggregate data on write to avoid expensive queries on read
