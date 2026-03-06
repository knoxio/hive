# Sprint Review — 2026-03-06

## Sprint Overview

**Date:** 2026-03-06
**Team:** bumblebee, sonnet-2, r2d2, saphire
**Coordinator:** ba

**Sprint Goal:** Improve TUI input UX (multiline paste, cursor navigation, word-skip),
add room discoverability via `room list`, and raise broker test coverage.

**Result:** All items delivered. Backlog cleared.

---

## Completed Items

### #129 / PR #136 — Broker unit tests (r2d2)

Added 22 unit tests covering `src/broker/auth.rs` and `src/broker/commands.rs`.

**Auth tests (8):** `issue_token` — new user, duplicate rejection, distinct UUIDs,
KICKED sentinel blocks re-issue. `validate_token` — valid lookup, unknown token,
post-kick invalidation, post-reauth cleared.

**Command tests (14):** `route_command` and `handle_admin_cmd` for every admin path:
`set_status` (set and clear), `who` (users listed with status, empty room), admin
permission gate (non-host rejected, no-host-set rejected), `kick` (token revoked +
sentinel inserted), `exit` (Shutdown returned), `reauth` (token + sentinel cleared),
`clear-tokens` (map emptied), `clear` (prior chat content removed).

**Files:** `src/broker/auth.rs`, `src/broker/commands.rs`
**Tests added:** 22

**Key decisions:**
- `RoomState` constructed directly from Arc components — no sockets, no broker process.
  Tests are fast and deterministic.
- `tempfile::NamedTempFile` used for `chat_path` in command tests that call
  `broadcast_and_persist` (disk I/O required).
- Discovered `clear` truncates then appends a system message — assertion updated to
  verify old content is gone rather than checking for an empty file.

---

### #132 / PR #132 — Module structure docs (bumblebee)

Updated `CLAUDE.md` codebase overview table to reflect the full broker/, oneshot/, and
tui/ sub-module directory trees. Updated `docs/testing.md` line references that pointed
at the old monolithic `tui.rs` and `oneshot.rs`.

**Files:** `CLAUDE.md`, `docs/testing.md`
**Tests added:** 0 (docs only)

---

### #133 / PR #137 — Bracketed paste support (bumblebee)

Added crossterm bracketed paste support to the TUI so pasted text arrives as a single
`Event::Paste` rather than individual `Event::Key` events. Without this, each newline
in a multiline paste fired `Action::Send`, fragmenting the message.

Three changes in `src/tui/mod.rs`: enable bracketed paste mode on terminal setup,
handle `Event::Paste(text)` by inserting the full string at the cursor position (newlines
preserved), disable bracketed paste mode on cleanup.

**Files:** `src/tui/mod.rs`
**Tests added:** 0 (terminal event handling; no unit-testable surface)

**Key decisions:**
- Mention picker is reset on paste — pasted text should not trigger autocomplete
  mid-paste.

---

### #134 / PR #139 — Up/down line navigation in multiline input (sonnet-2)

Added `byte_offset_at_display_pos` as the inverse of `cursor_display_pos` — walks input
chars tracking (row, col) with identical wrap/newline logic to convert display coordinates
back to byte offsets. Updated `handle_key` to accept `input_width` and used these helpers
so Up/Down moves the cursor between display rows when input spans multiple lines.

When the cursor is on the first display row, Up falls through to history scroll. When on
the last display row, Down falls through to history scroll.

**Files:** `src/tui/input.rs`, `src/tui/mod.rs`
**Tests added:** 11 (6 unit tests for `byte_offset_at_display_pos`; 5 for `handle_key`
up/down behaviour)

**Key decisions:**
- `byte_offset_at_display_pos` mirrors `wrap_input_display` / `cursor_display_pos` logic
  exactly so visual position is always consistent.
- Column is clamped at row boundaries — Up from col 10 on a 5-char row lands at end of
  that row.
- Adding `input_width` to `handle_key` required updating all 15+ existing test call sites.

---

### #135 / PR #141 — Alt+arrow word-skip navigation (saphire)

Added `prev_word_start` and `next_word_end` helpers to `src/tui/input.rs` and wired four
key bindings in `handle_key`: `Alt+Left`, `Alt+Right` (standard), `Alt+b`, `Alt+f`
(emacs-style, required for macOS Terminal where Option+arrow sends `Alt+b`/`Alt+f`).
Both helpers operate on char boundaries, so Unicode input is safe.

**Files:** `src/tui/input.rs`
**Tests added:** 11 (8 cases for `prev_word_start`, 7 for `next_word_end`, 4 binding
smoke tests in `handle_key`)

**Key decisions:**
- `prev_word_start` uses a two-phase reverse iterator (skip trailing whitespace, then skip
  word chars) rather than regex — keeps the crate `no_std`-compatible and adds no
  dependency.
- `Alt+b` / `Alt+f` wired alongside `Alt+Left` / `Alt+Right` for macOS Terminal
  compatibility where `Option+arrow` maps to emacs bindings.

---

### #138 / PR #140 — `room list` command (bumblebee)

Implemented `room list` — a no-token subcommand that discovers active rooms by scanning
`/tmp` for `room-*.sock` files, probing each socket with a 200 ms connect timeout to
verify the broker is alive, and printing one NDJSON line per active room:

```json
{"room":"myroom","socket":"/tmp/room-myroom.sock"}
{"room":"other","socket":"/tmp/room-other.sock","chat_path":"/tmp/room-other.chat"}
```

`chat_path` is read from a `.meta` sidecar file and omitted entirely (not serialised as
`null`) when no `.meta` file exists.

**Files:** `src/main.rs`, `src/oneshot/mod.rs`, `src/oneshot/list.rs` (new)
**Tests added:** 9 (4 meta-file parsing edge cases; 5 for `discover_rooms`: empty dir,
stale socket, live broker, missing meta, sort order)

**Key decisions:**
- Client-side filesystem scan — no wire protocol change needed and no token required.
- Results sorted alphabetically by room name.
- Stale socket (broker not running) detected by failed connect; silently skipped.
- `skip_serializing_if` used for optional `chat_path` so output is clean when no meta
  file is present.

---

## Metrics

| Metric | Value |
|---|---|
| Issues closed | 6 |
| PRs merged | 7 (one issue had two PRs due to rebase) |
| Tests at sprint close | 251 (195 unit + 56 integration) |
| Tests added this sprint | ~53 (r2d2: 22, sonnet-2: 11, saphire: 11, bumblebee: 9) |
| CI failures before merge | 1 (PR #136 — cargo fmt violation, fixed before merge) |

---

## Process Notes

**What went well:**
- All six sprint items delivered in a single session.
- No merge conflicts despite two agents touching `tui/input.rs` and two touching
  `tui/mod.rs`. Managed by: merging bracketed paste (#137) first, then directing
  sonnet-2 to rebase #139 before pushing; same for saphire rebasing #141 onto master
  after #139 merged.
- Agent check-in discipline held — all agents announced files before touching them and
  provided milestone updates.

**What to improve:**
- **`cargo fmt` before push:** r2d2's initial #136 push failed CI due to formatting
  violations on multi-line `assert!` and chained async calls. All agents must run
  `cargo fmt` locally before pushing. This is already in the pre-push checklist in
  `CLAUDE.md` — needs to be enforced, not just listed.
- **Baseline test count at sprint open:** sprint-start test count was not recorded
  precisely, making velocity measurement approximate. Recommend recording `cargo test`
  summary at sprint kickoff.
- **Shared-file declaration:** Both `tui/input.rs` and `tui/mod.rs` were touched by
  multiple agents. Declaring shared files explicitly at sprint planning (not just flagging
  mid-sprint) would let merge order be decided up front.

---

## Open Items

None. Backlog is clear.

---

*Compiled by ba from agent reports in agent-room-2.*
