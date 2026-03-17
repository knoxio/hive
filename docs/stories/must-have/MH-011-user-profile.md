# MH-011: User profile (username, avatar/initials, status)

**As a** Hive user
**I want to** view and edit my profile including username, avatar, and status
**So that** other users and agents can identify me in the chat and team views

## Complexity
M — Profile page is simple but avatar upload involves file handling, and status must propagate in real time to all connected clients

## Priority
P1 — Basic identity is needed for meaningful multi-user collaboration; without it all messages appear as unidentifiable entries

## Dependencies
- MH-007 (Login page) — profile is accessed by authenticated users only
- MH-010 (Redirect unauthenticated users) — profile route must be protected
- MH-008 (JWT sessions persisting) — profile API requires a valid session token

## Acceptance Criteria
- [ ] A profile page is accessible from the user menu at a stable route (e.g. `/profile`)
- [ ] Profile displays the current username, an avatar (uploaded image or auto-generated initials), and current status text
- [ ] User can edit their display name (distinct from login username, which is immutable)
- [ ] User can upload a profile picture (JPEG/PNG, max 2 MB); the image is resized to 128×128px on the server
- [ ] If no avatar is uploaded, a coloured circle with the user's initials is shown deterministically based on the username
- [ ] User can set a short status string (max 80 characters); status is visible to other users in the member list
- [ ] Profile changes save immediately on form submit with inline success/error feedback
- [ ] Updated avatar and status propagate to all connected clients within 2 seconds without a page reload

## Technical Notes
- Avatar upload: `POST /api/users/me/avatar` multipart form; store in the configured object storage (local FS for dev, S3-compatible for prod)
- Status updates: `PATCH /api/users/me` with `{ display_name?, status? }`; broadcast a `user_updated` event over WebSocket to connected clients
- Initials colour: deterministic hash of username to a palette of 8–12 accessible background colours
- Store `avatar_url` as a relative path; serve via `GET /api/users/:id/avatar` so storage backend is swappable
- Validate file type by magic bytes, not just extension
