# MH-012: User management (add/remove users, set roles)

**As a** Hive administrator
**I want to** add and remove users and assign roles
**So that** I can control who has access to the system and what they can do

## Complexity
L — Requires a user management UI, role permission model, invitation flow, and backend enforcement of role-based access control

## Priority
P1 — Multi-user deployments are impossible without user management; single-admin setups are blocked if the admin account is lost

## Dependencies
- MH-013 (Basic token-based auth) — user creation generates credentials
- MH-010 (Redirect unauthenticated users) — user management is admin-only
- MH-007 (Login page) — new users need login access after being added

## Acceptance Criteria
- [ ] An admin-only user management page lists all users with their username, display name, role, and last-active timestamp
- [ ] Admin can create a new user by entering a username, email, and initial password; a confirmation is sent to the email if SMTP is configured
- [ ] Admin can deactivate a user (soft delete) — deactivated users cannot log in but their messages are preserved
- [ ] Admin can permanently delete a user after explicit confirmation (typing the username)
- [ ] Admin can assign roles (`admin`, `member`, `viewer`) to any user; role changes take effect immediately
- [ ] A user cannot remove their own admin role if they are the last admin
- [ ] Role-based access is enforced server-side — elevated permissions are never granted based on client-provided claims alone
- [ ] User list is paginated for deployments with more than 50 users

## Technical Notes
- Roles: `admin` (full access), `member` (create rooms, send messages), `viewer` (read-only)
- Store roles in a `user_roles` table; check in middleware using the JWT `sub` claim to look up current role
- Deactivation: set `active = false`; login endpoint rejects deactivated users with HTTP 403
- Password reset by admin: generate a one-time token; user must change password on first login after reset
- Soft-delete vs. hard-delete: soft-delete is default; hard-delete requires a separate confirmation step and is irreversible
- Emit a `user_role_changed` WebSocket event so clients can update their local permission cache
