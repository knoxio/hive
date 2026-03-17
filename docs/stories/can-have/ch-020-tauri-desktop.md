# CH-020: Tauri Desktop Wrapper + Tray Icon

**As a** user, **I want to** run Hive as a native desktop application with a system tray icon, **so that** I can access it without opening a browser and receive native OS notifications.

**Complexity:** XL
**Priority:** P3
**Phase:** Can Have

## Dependencies
- Web frontend (React app to wrap)
- CH-022 (Notification sounds + browser push; shared notification infrastructure)

## Acceptance Criteria
- [ ] Tauri app wraps the existing React web frontend with no functional regressions
- [ ] System tray icon shows Hive status (online/offline) with a context menu (open, quit, settings)
- [ ] Tray icon badge shows unread message count
- [ ] Native OS notifications for new messages and alerts (macOS, Windows, Linux)
- [ ] Clicking a notification opens the app and navigates to the relevant room/message
- [ ] App starts on login (optional, configurable in settings)
- [ ] App minimizes to tray on window close (instead of quitting)
- [ ] Auto-update mechanism checks for new versions and prompts to update
- [ ] Deep links: `hive://room/<room-id>` opens the app to that room
- [ ] Cross-platform builds: macOS (DMG), Windows (MSI/NSIS), Linux (AppImage/deb)
- [ ] App size is under 50 MB (Tauri is lightweight compared to Electron)
- [ ] Integration test verifies the app launches, connects to backend, and displays the room list

## Technical Notes
- Use Tauri v2 for improved security model and multi-window support
- Tray icon implementation uses Tauri's `tray` API
- Auto-update via Tauri's built-in updater (requires a signed update manifest)
- Deep links require OS-level protocol registration (handled by Tauri's deep-link plugin)
- CI/CD should build platform-specific binaries and publish to GitHub Releases
- Consider using Tauri's IPC for features that benefit from native access (file system, notifications)
