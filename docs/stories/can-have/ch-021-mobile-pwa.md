# CH-021: Mobile PWA

**As a** user, **I want to** access Hive as a Progressive Web App on my mobile device, **so that** I can monitor rooms and agents on the go without installing a native app.

**Complexity:** L
**Priority:** P3
**Phase:** Can Have

## Dependencies
- Web frontend (responsive design)
- Service worker infrastructure
- CH-022 (Push notifications)

## Acceptance Criteria
- [ ] Web app has a valid PWA manifest (name, icons, theme color, start URL, display: standalone)
- [ ] Service worker caches static assets for offline shell loading
- [ ] "Add to Home Screen" prompt works on iOS Safari and Android Chrome
- [ ] App launches in standalone mode (no browser chrome) from home screen
- [ ] Responsive layout adapts to mobile screen sizes (320px-428px width)
- [ ] Touch interactions: swipe to switch rooms, long-press for message context menu
- [ ] Message input is mobile-friendly (auto-growing textarea, send button, no accidental submits)
- [ ] Room list is accessible via a hamburger menu or bottom tab navigation
- [ ] Offline state shows a clear indicator and queues messages for send when reconnected
- [ ] Push notifications work on Android (iOS push for PWAs requires separate handling)
- [ ] Performance: initial load under 3 seconds on 4G, Lighthouse PWA score > 90
- [ ] Unit tests cover service worker caching logic
- [ ] Manual test plan covers iOS Safari, Android Chrome, and Samsung Internet

## Technical Notes
- PWA manifest and service worker registration should be added to the existing React build
- Use Workbox for service worker generation (precaching + runtime caching strategies)
- Offline message queue: store pending messages in IndexedDB, send on reconnect
- iOS PWA limitations: no push notifications (until iOS 16.4+), no background sync; document these
- Consider a bottom navigation bar (Rooms, Timeline, Agents, Settings) for mobile UX
