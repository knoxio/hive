# CH-022: Notification Sounds + Browser Push Notifications

**As a** user, **I want to** receive audio notifications and browser push notifications for new messages and events, **so that** I am alerted to activity even when the Hive tab is not focused.

**Complexity:** M
**Priority:** P2
**Phase:** Can Have

## Dependencies
- Web frontend
- WebSocket real-time message delivery
- Service worker (for push notifications)

## Acceptance Criteria
- [ ] Audio notification plays when a new message arrives in a subscribed room
- [ ] Notification sounds are configurable: per room (on/off/mentions-only) and globally (on/off)
- [ ] Built-in sound options (at least 3 distinct sounds) with the ability to use a custom sound file
- [ ] Browser push notifications are requested via the Notifications API with user consent
- [ ] Push notification content: sender name, room name, message preview (first 80 chars)
- [ ] Clicking a push notification focuses the Hive tab and navigates to the relevant room
- [ ] Notifications are suppressed when the Hive tab is focused (no self-notification)
- [ ] Do Not Disturb mode: globally mute all notifications for a configurable duration
- [ ] Notification preferences persist across sessions (stored in localStorage or user settings API)
- [ ] Sound volume is adjustable
- [ ] Unit tests cover notification preference logic (when to fire, when to suppress)
- [ ] Manual test plan covers notification behavior in Chrome, Firefox, Safari, and Edge

## Technical Notes
- Use the Web Audio API for sound playback (more reliable than `<audio>` elements)
- Browser push notifications use the Notifications API (not a push server; that is a future enhancement)
- Sound files should be small (< 50 KB, MP3 or OGG format) and bundled as static assets
- DND mode uses a timer that sets a global suppress flag; check on every incoming message
- Consider integrating with OS-level focus/DND detection where available
