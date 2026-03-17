# CH-019: Billing Dashboard with Budget Alerts

**As a** workspace owner, **I want to** view billing information and set budget alerts, **so that** I can control costs and receive warnings before exceeding spending limits.

**Complexity:** L
**Priority:** P3
**Phase:** Can Have

## Dependencies
- CH-001 (Cost tracking per agent)
- Authentication/authorization (billing is owner/admin only)

## Acceptance Criteria
- [ ] Billing dashboard shows total spend for the current billing period (month by default)
- [ ] Spend is broken down by: agent, model, room, and day
- [ ] Historical spend chart shows trends over the last 6 months
- [ ] Budget alerts: admin sets a monthly budget; alerts fire at configurable thresholds (50%, 80%, 90%, 100%)
- [ ] Alerts are delivered via: in-app notification, email (if configured), and room system message
- [ ] Hard cap option: when budget is exceeded, new agent requests are blocked (with override for admin)
- [ ] Billing estimates: projected end-of-month spend based on current usage rate
- [ ] Invoice-like summary exportable as PDF or CSV
- [ ] Budget configuration via REST API: `GET/PUT /api/billing/budget`
- [ ] Billing data is visible only to workspace owners and billing admins
- [ ] Unit tests cover budget threshold calculation and alert trigger logic
- [ ] Integration test verifies that exceeding a budget threshold produces an alert event

## Technical Notes
- Billing data is derived from cost tracking (CH-001); this story adds the UI and alerting layer
- Budget periods should be configurable (monthly, weekly) with a default of monthly
- Alert delivery should be pluggable (start with in-app + room message; add email later)
- Projected spend calculation: (current spend / days elapsed) * days in period
- Consider a "cost anomaly" detector that alerts on sudden spend spikes (>2x daily average)
