# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Fixed
- `e2e/mh027-ws-reconnect.spec.ts`: replace `page.route('**/ws/**')` with `page.routeWebSocket('**/ws/**')` for WS interception — `page.route` does not intercept ws:// upgrade requests in Playwright 1.58+; add `**/api/rooms/*/messages**` mock to `setupPage` so `loadInitial` does not produce unhandled fetch rejections when a room is selected
- `src/lib/apiError.ts` (`apiFetch`): return `undefined` on 204 No Content instead of calling `res.json()` — leave/delete endpoints that return 204 were causing a JSON parse error, silently aborting state updates such as `setJoinedRoomIds` after leaving a room
- `e2e/logout-mh009.spec.ts` (`setupPage`): add sessionStorage guard to `addInitScript` so the mock JWT is only injected on the first page load per tab session — prevents re-injection after logout when `page.goto('/rooms')` triggers another init script run, which was causing the post-logout protected-route redirect test to fail
- `e2e/switch-rooms-mh017.spec.ts` — scope "clicking the same room twice" selector to `[data-testid="room-item"]` to avoid strict-mode violation when room header h2 and MemberPanel both contain the room name (#286)
- `e2e/mh019-join-leave.spec.ts` — scope `getByText('#room-alpha/beta')` to modal element to avoid matching sidebar copies; add explicit `toBeVisible` waits before `leave-room-btn`/`join-room-btn` clicks to handle auto-seed race condition (#286)
- `playwright.config.ts` now uses `testMatch` covering both `./e2e/` and `./tests/e2e/` — 40 tests in `tests/e2e/` were previously orphaned and never run by CI (#173)
- Replaced constant-value test assertions in `ws_relay.rs` and `rooms.rs` with behavior assertions; extracted `validate_description_len` helper from inline handler guard (#176)
- Added `.fallback(fallback_handler)` to the axum router — unknown routes now return `{"error": "not_found"}` with `Content-Type: application/json` and status 404 instead of an empty-body 404 (#253)
- `tests/e2e/app-shell.spec.ts`: replaced invalid `.or()` assertion syntax with `toHaveAttribute('aria-selected','true')`; added `page.click('body')` before keyboard shortcuts to ensure page focus
- `tests/e2e/member-panel.spec.ts`, `tests/e2e/message-input.spec.ts`: added `hive-joined-rooms`+rooms/messages/members route mocks, navigate to `/rooms/general` so `MemberPanel`/`MessageInput` render (they require a selected room)
- `tests/e2e/chat-timeline.spec.ts`: updated messages route pattern to `**/api/rooms/*/messages**` so query-parameterised history URLs match
- `src/components/RoomList.tsx`: added `data-testid="room-list"` to `ul` element for test discoverability

### Added
- `GET /api/users/me` endpoint — returns username, role, and ID from JWT claims (MH-011)
- Profile page at `/profile` — displays avatar initials, username, role badge, and user ID
- Profile nav button in app header (avatar initials circle) linking to `/profile`
- `POST /api/rooms/:id/join` and `POST /api/rooms/:id/leave` endpoints — join/leave room membership (MH-019)
- JoinRoomModal — browse all workspace rooms and join/leave from a modal dialog (MH-019)
- Sidebar now shows only joined rooms; joined state persisted to localStorage (MH-019)
- "Leave" button in room header for quick leave of the current room (MH-019)
- `useWebSocket` reconnects on room switch — `url` added to auto-connect effect deps so navigating between rooms tears down the old WebSocket and opens a new one (MH-027)

