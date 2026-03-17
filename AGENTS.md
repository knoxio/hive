# Hive — Agent Coordination Guide

> **TL;DR — read these first**
>
> 1. Token is in `.room-agent.json` — never run `room join` (token is pre-provisioned)
> 2. Clone hive to `/tmp/hive-<your-username>` — never work in a shared clone
> 3. Announce plan and wait for go-ahead before writing code
> 4. One agent per file — declare ownership before touching a file
> 5. Run `just ci` before every push — CI enforces all four checks
> 6. Every PR must include tests in the same PR; test count must not decrease
> 7. Always have a `room watch` running in the background

## What is Hive?

Hive is an orchestration platform for room-based multi-agent workflows.
It consists of:
- **hive-server** (`crates/hive-server/`) — Rust/axum backend (REST + WebSocket)
- **hive-web** (`hive-web/`) — React + TypeScript frontend (Vite + Tailwind + Playwright)
- **room daemon** — the coordination backend (separate process; hive proxies to it)

## Identity

Your username, token, and room ID are in `.room-agent.json` in your working directory.
Read it at startup. Use the token from it for all `room send`/`room poll` commands.

**Never run `room join`** — your token is already provisioned by the host.
**Never change your username** — it is assigned and fixed.

## Clone convention

Every agent must work in an isolated clone:

```bash
git clone https://github.com/knoxio/hive /tmp/hive-<your-username>
cd /tmp/hive-<your-username>
```

Do not share a clone with another agent. Branch-switching in a shared clone
will corrupt another agent's uncommitted work.

## Communication

```bash
# Send a message
room send <room-id> -t <token> your message here

# Poll for new messages
room poll <room-id> -t <token>

# Block until a foreign message arrives (run in background)
room watch <room-id> -t <token> --interval 5

# Query recent history
room query -t <token> --all -n 20
```

Update your status at every milestone. Stale statuses are worse than none.

Good: `/set_status implementing ProfilePage.tsx for tb-116 MH-011`
Bad: `/set_status working`

## Task workflow

Follow this sequence for every task:

1. **Claim**: `/taskboard claim <task-id>`
2. **Plan**: `/taskboard plan <task-id> <your implementation plan>`
3. **Wait** for approval from BA before writing any code
4. **Read** target files before modifying them
5. **Implement** — announce at each milestone
6. **Test** — run `just ci` before committing
7. **PR** — open with CHANGELOG entry, announce in room
8. **Finish**: `/taskboard finish <task-id>`, update status

**Fast-track for small tasks** (<30 min): claim + announce plan in one room message.
BA can approve inline. Still requires a ticket.

## Pre-push checklist

Run before every `git push`. CI enforces all four steps and will fail otherwise.

```bash
just ci          # recommended — runs all steps in order
```

Or manually:

```bash
cargo check -p hive-server               # catches syntax/type errors
cargo fmt -- --check                     # verify formatting (run cargo fmt to fix)
cargo clippy -p hive-server -- -D warnings  # fix root causes, never suppress
cargo test -p hive-server                # all Rust tests must pass
cd hive-web && node_modules/.bin/tsc --noEmit  # TypeScript must type-check cleanly
cd hive-web && pnpm build                # production build must succeed
cd hive-web && pnpm exec eslint src/     # no ESLint warnings
```

**Order matters:** check before fmt (catches conflict markers), fmt before clippy
(style changes can trigger complexity warnings).

## Workspace structure

```
Cargo.toml                — cargo workspace root (no [package])
Cargo.lock                — shared lock file
crates/
  hive-server/
    src/
      main.rs             — server entrypoint, route wiring, AppState
      auth.rs             — JWT login, token validation, auth_middleware, seed_admin
      db.rs               — SQLite setup, schema migrations (SCHEMA_V1..VN)
      users.rs            — GET /api/users/me
      settings.rs         — GET/PATCH /api/settings, GET /api/settings/history
      rest_proxy.rs       — /api/rooms/* (proxies to room daemon)
      ws_relay.rs         — /ws/{room_id} WebSocket relay to daemon
      daemon.rs           — daemon connection helpers
      config.rs           — hive.toml config loading
      error.rs            — HiveError enum, JSON error responses
    tests/                — integration tests (if any)
hive-web/
  src/
    main.tsx              — app entrypoint, BrowserRouter, route definitions
    App.tsx               — main layout, tab nav, WebSocket, logout
    components/
      LoginPage.tsx       — /login route, JWT login form
      ProfilePage.tsx     — /profile route, user identity display (MH-011)
      RequireAuth.tsx     — auth guard, redirects to /login
      ErrorBoundary.tsx   — React error boundary
      ErrorPage.tsx       — 404 and generic error pages
      EmptyState.tsx      — reusable empty-state component
      FieldError.tsx      — inline form validation error
      RoomList.tsx        — room sidebar list
      AgentGrid.tsx       — agent status grid
      ChatTimeline.tsx    — message timeline
      MemberPanel.tsx     — room member panel
      MessageInput.tsx    — message input field
      Skeleton.tsx        — loading skeleton
    lib/
      auth.ts             — token storage (getToken/setToken/clearToken/authHeader)
      apiError.ts         — apiFetch wrapper, parseApiError, AppError type
    hooks/
      useWebSocket.ts     — WebSocket connection hook
  e2e/                    — Playwright end-to-end tests
  playwright.config.ts    — Playwright config (baseURL localhost:5173)
  package.json            — pnpm workspace (React 19, Vite 6, Tailwind 4, Playwright)
justfile                  — dev commands: just dev / just ci / just test / just build
docker-compose.yml        — production compose
docker-compose.dev.yml    — dev compose overrides
```

## Key invariants

- **Auth token is `hive-auth-token`** (hyphen, not underscore) in localStorage.
  Use `getToken()`/`setToken()`/`clearToken()` from `lib/auth.ts`. Never access
  `localStorage` directly for auth state.
- **`apiFetch` for all API calls** — it maps HTTP errors to `AppError` and
  prevents raw status codes reaching users. Never use bare `fetch` in components.
- **`HiveError` for all backend errors** — return `HiveError::NotFound(...)` etc.
  from handlers. Never use manual `(StatusCode, Json(...))` tuples.
- **JWT claims are in request extensions** — `auth_middleware` inserts `Claims`
  into extensions before handlers run. Extract with `Extension(claims): Extension<Claims>`.
- **Schema migrations are append-only** — add `SCHEMA_VN` constants and a
  `if current < N` block. Never drop or rename columns. Additive changes to existing
  tables use `ALTER TABLE ... ADD COLUMN` inside a new schema version.
- **No `as any`, `ts-ignore`, or `#[allow(...)]`** — fix the root cause.
- **Clippy config**: `cognitive-complexity-threshold = 30`,
  `too-many-lines-threshold = 600`, `too-many-arguments-threshold = 7`.
  Do not raise these limits.
- **Playwright tests use `page.route()`** for API mocking — no live backend needed.
  Set `hive-auth-token` in `localStorage` via `page.evaluate()` to simulate auth.
- **PR must not open until merge-order predecessor merges** — main.tsx and
  schema-touching PRs follow BA-defined merge order. Implement early, open PR after.

## Schema migrations

Schema is managed in `crates/hive-server/src/db.rs`:

```rust
const SCHEMA_VERSION: i64 = N;  // bump when adding a new migration

const SCHEMA_VN: &str = r#"
-- SQL for version N
"#;

// In migrate():
if current < N {
    conn.execute_batch(SCHEMA_VN)?;
    conn.execute("INSERT INTO _migrations (version) VALUES (N)", [])?;
    tracing::info!("database migrated to schema vN");
}
```

**Always wait for the prior schema PR to merge** before writing a new migration.
Schema merge order is set by BA for each sprint wave.

## Wave-based coordination

Sprint work is organised into waves by dependency profile.

| Wave | Tasks | Merge strategy |
|------|-------|----------------|
| 1 | Bug fixes, independent tasks | Parallel |
| 2 | Test gaps, independent tasks | Parallel |
| 3 | Shared-file tasks (auth, settings) | Sequential — BA defines merge order |
| 4+ | Build on Wave 3 | Sequential or parallel as defined |

**Rules for sequential waves:**
- BA announces merge order before the wave starts
- Agents implement in parallel but wait for their turn to merge
- Rebase on master after the prior PR merges, then push
- Do not open a PR until the prior PR in the sequence has merged

## Coordination rules

- **One agent per file at a time.** Declare file ownership in your plan announcement.
- **Schema changes need consensus.** Announce and wait for agreement.
- **The host (BA) has final say.** If BA sends "hold", stop immediately and wait.
- **All work needs a ticket.** File a GitHub issue before starting any implementation.
- **File bugs, don't self-assign.** Report to BA in the room; wait for assignment.
- **Announce before every push, fix commit, or rebase** — never push silently.
- **Do not merge without announcing** in the room first.

## Tests-in-same-PR rule

Every PR that adds or changes functionality must include tests in the same PR.

- **Backend** (Rust): unit tests in `#[cfg(test)] mod tests` inside the source file.
  Integration tests (if any) in `tests/` directory.
- **Frontend** (Playwright): `e2e/<feature>.spec.ts`. Use `page.route()` for API mocking.
- Test count must never decrease without explicit justification in the PR description.

## CHANGELOG rule

Every PR description must include a CHANGELOG entry under `[Unreleased]`:

```markdown
### Added
- `GET /api/users/me` endpoint returning username, role, and ID from JWT claims (MH-011)
- Profile page at `/profile` — displays username, role badge, and avatar initials
```

No CHANGELOG entry → PR will be rejected by BA.

## Docs accuracy rule

Every PR description must include this checkbox:

```
- [ ] Verified docs and README are accurate after this change (no drift)
```

## PR checklist template

```markdown
## Summary
- ...

## Test plan
- [ ] `cargo test -p hive-server` passes
- [ ] `node_modules/.bin/tsc --noEmit` passes
- [ ] `pnpm build` succeeds
- [ ] `pnpm exec eslint src/` clean
- [ ] Playwright tests added for new behaviour

## Checklist
- [ ] CHANGELOG entry added under [Unreleased]
- [ ] Verified docs and README are accurate after this change (no drift)
- [ ] Test count did not decrease (or explained if it did)
```

## Progress files

For long-running tasks, write progress to `/tmp/hive-progress-<issue>.md`.
Delete after the PR merges.

```markdown
# Progress: #<issue> — <title>

## Status
<!-- reading | drafting | testing | pr-open | blocked | done -->

## Completed steps
- [ ] Read target files
- [ ] First draft implemented
- [ ] Tests written
- [ ] just ci passes
- [ ] PR opened

## Files modified
<!-- list with one-line descriptions -->

## Decisions made
<!-- key trade-offs -->

## Blockers
```
