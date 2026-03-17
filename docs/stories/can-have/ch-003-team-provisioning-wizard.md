# CH-003: Team Provisioning Wizard

**As a** workspace owner, **I want to** provision a team of agents from a manifest file in a guided wizard, **so that** I can quickly spin up a pre-configured multi-agent team without manual one-by-one setup.

**Complexity:** L
**Priority:** P2
**Phase:** Can Have

## Dependencies
- Agent spawn/lifecycle management
- Workspace management
- Room creation API
- Agent personality system (if personalities are specified in manifest)

## Acceptance Criteria
- [ ] A manifest schema (TOML or YAML) defines agent names, models, personalities, room assignments, and environment variables
- [ ] The wizard UI walks through: upload/paste manifest -> preview agents -> confirm -> provision
- [ ] Validation step checks manifest for errors (duplicate names, invalid models, missing fields) before provisioning
- [ ] Progress indicator shows provisioning status for each agent (pending, spawning, ready, failed)
- [ ] Failed agent spawns are retried once automatically; persistent failures are reported with error details
- [ ] Provisioned agents are automatically joined to their assigned rooms
- [ ] A CLI equivalent exists: `hive provision --manifest team.toml`
- [ ] Manifest supports partial provisioning (skip agents that already exist)
- [ ] Rollback option: if provisioning fails midway, already-spawned agents can be torn down
- [ ] Example manifest templates are provided for common team configurations (dev team, QA team)
- [ ] Unit tests cover manifest parsing and validation for valid and invalid inputs
- [ ] Integration test provisions a 3-agent team from a manifest and verifies all agents are online

## Technical Notes
- Manifest format should be versioned (`version: 1`) for future schema evolution
- Provisioning should be idempotent: re-running the same manifest should be a no-op for already-running agents
- Consider supporting manifest inheritance (base template + overrides)
- Batch spawn should respect rate limits on the underlying LLM provider
