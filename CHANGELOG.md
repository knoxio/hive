# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **TUI: welcome splash redesign** — antenna with blinking light (✦/·) on top, right eye
  winks instead of both blinking, "room" label continues to pulse. README logo updated
  with antenna. (#177)

## [1.0.1] - 2026-03-06

### Added

- **TUI: welcome splash with blinking eyes** — a compact ASCII logo with animated
  blinking eyes displays in the message pane when the room has no chat messages yet.
  The eyes alternate between `◉` and `○` every ~500ms, and the "room" label pulses
  between cyan and gray. (#169)

### Fixed

- **Oneshot: DMs delivered to watch/poll recipients** — `room watch` now includes
  direct messages addressed to the watching user in its foreign-message filter. Previously
  DMs were consumed from the cursor but silently dropped. (#173)
- **TUI: command palette ranks prefix matches first** — typing `/he` now shows `/help`
  before `/who`. Previously, description-text matches (e.g. "the" in `/who`'s description)
  could rank above command-name prefix matches. (#172)
- **TUI: palette and mention picker reactivate on backspace** — if the palette or mention
  picker was auto-dismissed because all matches disappeared, deleting characters to restore
  a matching query now reactivates the picker. (#172)
- **TUI: Ctrl+C exits cleanly in one press** — in TUI mode, `Ctrl+C` now exits immediately
  and returns to the shell prompt. Previously, the process waited for a second `Ctrl+C`
  because the broker signal handler consumed the first one. (#171)
- **TUI: paste normalizes CRLF line endings** — bracketed paste now converts `\r\n` and
  stray `\r` to `\n` before inserting into the input buffer. (#170)

## [1.0.0] - 2026-03-06

### Added

- **Plugin system** — compile-time `Plugin` trait with `CommandContext` providing
  `HistoryReader`, `ChatWriter`, and `RoomMetadata`. Plugins post messages as
  `plugin:<name>` and cannot impersonate users. `PluginRegistry` prevents command
  collisions. Two built-in plugins ship as dogfood: `/help` (lists all commands with
  descriptions) and `/stats` (message count, participants, time range, most active user).
  (#160)
- **WebSocket + REST transport** — opt-in via `--ws-port <port>`. Adds axum 0.8 HTTP
  server with WebSocket at `/ws/{room_id}` and REST endpoints at
  `/api/{room_id}/{join,send,poll,health}`. REST uses `Authorization: Bearer <token>`.
  Parallel handler approach — zero changes to existing UDS code. (#162)
- **Cargo workspace** — root `Cargo.toml` now declares `[workspace]` with `crates/`
  directory for future members. The main `room` crate stays at the repo root. (#152)
- **TUI: Esc clears input** — pressing `Esc` when the input box has text clears it
  entirely. (#161)
- **TUI: Alt+Backspace deletes word** — deletes the word before the cursor, matching
  standard terminal behavior. (#161)
- **TUI: unique per-user colors** — color assignment uses a deterministic hash with
  collision avoidance, ensuring adjacent users always get distinct colors. (#163)
- **DX: pre-push.sh** — git hook script running `cargo check`, `cargo fmt`, `cargo clippy
  -- -D warnings`, and `cargo test` in order. (#153)
- **WS smoke tests** — 5 end-to-end tests for `--ws-port` covering health, join, send,
  poll, and WebSocket interactive mode. (#165)

### Fixed

- **TUI: mention picker syncs on cursor movement** — moving the cursor with arrow keys
  while the mention picker is open now correctly updates or dismisses the picker based
  on the `@` context at the new cursor position. (#166)
- **TUI: scroll clamping uses layout-derived height** — scroll offset is now clamped to
  the actual rendered message area height instead of a hardcoded estimate, fixing scroll
  breakage on long messages. (#164)

## [0.8.0] - 2026-03-06

### Added

- **TUI: Alt+Left/Right word-skip navigation** — cursor jumps to the previous or next
  word boundary in the input box. (#141)
- **TUI: Up/Down arrow navigation within multiline input** — arrow keys move the cursor
  between lines in the input box instead of scrolling history. (#139)
- **TUI: bracketed paste support** — pasted text is inserted as-is without triggering
  per-character key events. (#133)
- **CLI: `room list`** — discovers active rooms by scanning `/tmp/room-*.sock` with a
  200ms connect timeout. Outputs NDJSON with room ID, socket path, and user count. (#140)
- **Broker unit tests** — added unit tests for auth, commands, and fanout modules. (#136)
- **Sprint docs** — `docs/sprint-review-2026-03-06.md` and `docs/retro-2026-03-06.md`. (#132)

### Changed

- **Module split** — broker code split into `broker/{mod,state,auth,commands,fanout}`,
  oneshot into `oneshot/{mod,transport,token,poll,watch,list}`, TUI into
  `tui/{mod,input,render,widgets}`.

## [0.7.0] - 2026-03-06

### Added

- **Documentation site** — `docs/` folder with quick-start guide, broker internals,
  authentication lifecycle, commands reference, and agent coordination guide. (#77-#86)

### Fixed

- **Broker: `/exit` sends EOF to all clients** — TUI exits cleanly when the host runs
  `/exit`. (#69)
- **Broker: shutdown signal** — replaced `Arc<Notify>` with `watch::channel` for reliable
  shutdown propagation. (#75)
- **TUI: preserve explicit newlines** — chat messages containing `\n` now render across
  multiple lines instead of showing the literal escape sequence. (#71)
- **TUI: seed @mention from message senders** — poll/send agents now populate the mention
  autocomplete list from message history, not just `/who` output. (#68)

## [0.6.0] - 2026-03-06

### Changed

- **Unified `/` command prefix** — all commands (admin and user) now use the `/` prefix.
  The `\` prefix for admin commands has been removed. (#48)

### Added

- **Sequential message sequence numbers** — every message gets a monotonically increasing
  `seq` field for reliable ordering. (#60)
- **Admin command restrictions** — admin commands (`/kick`, `/reauth`, `/clear-tokens`,
  `/exit`, `/clear`) are now restricted to the room host. (#63)
- **TUI: `set_status` in palette** — `/set_status` appears in the command palette. (#58)

### Fixed

- **TUI: seed @mention on startup** — the mention picker populates from `/who` output
  immediately on connect. (#59)

## [0.5.0] - 2026-03-06

### Added

- **Admin commands** — `/kick`, `/reauth`, `/clear-tokens`, `/exit`, `/clear` for room
  host administration. (#43)
- **TUI: @mention autocomplete** — typing `@` opens a picker with online usernames,
  per-user color highlighting. (#45, #53)
- **CLI: `room pull`** — fetch the last N messages without advancing the cursor. (#50, #54)
- **CI: workflow_dispatch** — release workflow can be triggered manually as a fallback. (#44)

### Fixed

- **Broker: kick removes user from status map** — `/who` no longer lists kicked users. (#55)

## [0.4.2] - 2026-03-06

### Added

- **Session token auth** — `room join` issues a UUID token written to
  `/tmp/room-<id>-<username>.token`. All subsequent commands require `-t <token>`. (#39)

### Changed

- **Token files namespaced per user** — prevents collision when multiple agents join from
  the same machine. (#41, #42)

## [0.4.1] - 2026-03-06

### Fixed

- **Oneshot: wrap plain sends in JSON envelope** — preserves embedded newlines in messages
  sent via `room send`. (#34)

## [0.4.0] - 2026-03-06

### Added

- **TUI: multi-line input with line wrapping** — the input box now grows up to 6 lines as
  text is typed. Long lines wrap visually instead of scrolling horizontally. `Shift+Enter`
  inserts a newline at the cursor; plain `Enter` continues to send. Cursor placement is
  Unicode-width-aware (CJK and fullwidth characters counted correctly).
- **TUI: `\` + Enter inserts a newline** — an alternative to `Shift+Enter`: if the
  character immediately before the cursor is a backslash, pressing `Enter` strips the
  backslash and inserts a newline in its place.
- **TUI: command palette** — typing `/` at the start of an empty input opens an overlay
  listing all available slash commands with descriptions. Continues to filter as you type,
  navigate with `Up`/`Down`, complete with `Enter` or `Tab`, dismiss with `Esc`.
- **CLI: `room watch`** — blocks until a foreign message arrives, then exits. Replaces
  external polling scripts. (#38)

### Fixed

- **CLI: `--version` flag field** — changed to unit type so `clap` no longer treats it as
  a required positional argument.

## [0.3.0] - 2026-03-05

### Added

- **CLI: `-v` / `--version` flag** — `room -v` and `room --version` now print the version
  and exit cleanly.
- **TUI: visible cursor with mid-line editing** — a terminal cursor tracks the insertion
  point inside the input box. Left/Right move it one Unicode scalar at a time; Home/End
  jump to line boundaries. Horizontal scrolling keeps the cursor visible when text
  overflows the box width. Wide characters (CJK, fullwidth) are measured in display
  columns via `unicode-width`.
- **One-shot DMs via `room send`** — `room send <room> <user> --to <recipient> <msg>`
  delivers a direct message without requiring `--agent` mode.

### Fixed

- **TUI: message list scrolling** — the message pane now auto-scrolls to the latest
  message and correctly accounts for wrapped multi-line messages when computing scroll
  offsets.

## [0.2.0] - 2026-03-05

### Added

- **TUI: room name in title bar** — the message panel now displays the actual room ID
  instead of the hardcoded string `"room"`.
- **TUI: per-user colors** — each username is assigned a distinct color from a 10-color
  palette using a deterministic hash, making it easy to distinguish speakers at a glance.
  The `[dm]` prefix retains magenta; only the sender name adopts the per-user color.
- **TUI: word-wrap long messages** — messages that exceed the terminal width now wrap at
  word boundaries and indent continuation lines to align under the content start. Hard
  splits are used for words longer than the available width. Unicode-aware: uses character
  counts rather than byte lengths throughout.
- **Docs: autonomous agent polling loop** — `CLAUDE.md`, `README.md`, and the
  `room-coordination` skill now document the `run_in_background` + `TaskOutput` pattern
  for agents that need to stay resident without human re-prompting. Covers self-message
  filtering, file-based poll output (avoiding `$()` hook blocking), and cursor persistence.

### Changed

- **Deps: ratatui 0.29 → 0.30, crossterm 0.28 → 0.29** — picks up upstream fixes and
  bumps `lru` from 0.12.5 to 0.16.3, resolving a soundness advisory in `IterMut`.
- **Refactor: `handle_client` arguments** — shared broker state (`clients`, `status_map`,
  `host_user`, `chat_path`, `room_id`) is now bundled into a `RoomState` struct, satisfying
  the `clippy::too_many_arguments` lint without suppression.

### Fixed

- `cargo fmt` and `cargo clippy` now pass cleanly on all source files.

## [0.1.4] - 2026-03-05

### Changed

- Added `cargo-release` configuration (`release.toml`).

## [0.1.3] - 2026-03-05

### Fixed

- Allow dirty working tree during `cargo publish` (Cargo.lock not ignored by crates.io).

## [0.1.2] - 2026-03-04

### Added

- Initial public release with `room send` / `room poll` one-shot subcommands.
- Cursor file at `/tmp/room-<id>-<username>.cursor` for stateless incremental polling.
- `SEND:` handshake in the broker for one-shot sends — no join/leave events emitted.
- Direct messages (`dm` wire type) delivered only to sender, recipient, and broker host.
- `/set_status` and `/who` broker commands.
- TUI built with ratatui (split-pane, scroll, key bindings).
- `--agent` mode for long-lived processes with JSON stdin/stdout.
- Claude Code plugin with `room-coordination` skill and `/room:check`, `/room:send` commands.

[Unreleased]: https://github.com/knoxio/room/compare/v1.0.1...HEAD
[1.0.1]: https://github.com/knoxio/room/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/knoxio/room/compare/v0.8.0...v1.0.0
[0.8.0]: https://github.com/knoxio/room/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/knoxio/room/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/knoxio/room/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/knoxio/room/compare/v0.4.2...v0.5.0
[0.4.2]: https://github.com/knoxio/room/compare/v0.4.1...v0.4.2
[0.4.1]: https://github.com/knoxio/room/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/knoxio/room/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/knoxio/room/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/knoxio/room/compare/v0.1.4...v0.2.0
[0.1.4]: https://github.com/knoxio/room/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/knoxio/room/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/knoxio/room/releases/tag/v0.1.2
