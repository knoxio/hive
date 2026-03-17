# MH-024: Auto-scroll to latest message

**As a** room member
**I want to** have new messages automatically scroll into view when I am at the bottom of the chat
**So that** I can follow a live conversation without manually scrolling

## Complexity
S — Auto-scroll logic with a "scroll lock" that disables auto-scroll when the user has scrolled up

## Priority
P0 — Without auto-scroll, following a live conversation requires constant manual effort

## Dependencies
- MH-022 (Real-time receive via WebSocket) — new messages trigger the auto-scroll check
- MH-023 (Message history with scroll-back) — scroll-back must disable auto-scroll

## Acceptance Criteria
- [ ] When the user is at or near the bottom of the message list (within 100px), new incoming messages cause the list to scroll to the bottom automatically
- [ ] When the user has scrolled up to read history, new incoming messages do NOT auto-scroll — the position is preserved
- [ ] When auto-scroll is suppressed, a "New messages" indicator appears (e.g. a floating badge at the bottom of the chat)
- [ ] Clicking the "New messages" indicator scrolls to the bottom and re-enables auto-scroll
- [ ] Entering a room for the first time (or switching to a room) scrolls to the bottom immediately
- [ ] Auto-scroll uses smooth scrolling for new real-time messages; it uses instant scrolling for room-switch navigation
- [ ] Auto-scroll works correctly when messages are loaded in batches (e.g. during reconnect catch-up)

## Technical Notes
- Track "is user at bottom" with a scroll event listener; debounce to 100ms to avoid excessive re-renders
- "At bottom" threshold: `scrollHeight - scrollTop - clientHeight < 100`
- Use `element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })` for real-time auto-scroll
- Use `element.scrollTop = element.scrollHeight` (no animation) for room-switch navigation
- "New messages" badge: show count of messages received while scrolled up; clear on scroll-to-bottom
- Be careful with virtualised lists (MH-023): `scrollHeight` may not reflect the full content height — use the virtualiser's `scrollToIndex` API instead
