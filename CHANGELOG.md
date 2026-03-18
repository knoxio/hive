# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Fixed
- `playwright.config.ts` now uses `testMatch` covering both `./e2e/` and `./tests/e2e/` — 40 tests in `tests/e2e/` were previously orphaned and never run by CI (#173)
- Replaced constant-value test assertions in `ws_relay.rs` and `rooms.rs` with behavior assertions; extracted `validate_description_len` helper from inline handler guard (#176)

### Added
- `GET /api/users/me` endpoint — returns username, role, and ID from JWT claims (MH-011)
- Profile page at `/profile` — displays avatar initials, username, role badge, and user ID
- Profile nav button in app header (avatar initials circle) linking to `/profile`
- `POST /api/rooms/:id/join` and `POST /api/rooms/:id/leave` endpoints — join/leave room membership (MH-019)
- JoinRoomModal — browse all workspace rooms and join/leave from a modal dialog (MH-019)
- Sidebar now shows only joined rooms; joined state persisted to localStorage (MH-019)
- "Leave" button in room header for quick leave of the current room (MH-019)
- `useWebSocket` reconnects on room switch — `url` added to auto-connect effect deps so navigating between rooms tears down the old WebSocket and opens a new one (MH-027)

