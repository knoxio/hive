# MH-006: Error states with actionable messages

**As a** user who encounters an error in Hive
**I want to** see a clear, actionable error message
**So that** I can understand what went wrong and take a concrete step to resolve it

## Complexity
S — Primarily UI and error-handling plumbing; requires a consistent error boundary and toast/inline error pattern across all views

## Priority
P1 — Cryptic or missing error messages are a top driver of user frustration and support requests

## Dependencies
- MH-001 (CORS) — network errors from CORS failures must be caught and displayed
- MH-005 (Empty states) — error states complement but are distinct from empty states
- MH-026 (Connection status indicator) — WS errors feed into this story

## Acceptance Criteria
- [ ] All API errors surface a human-readable message; raw HTTP status codes or stack traces are never shown to users
- [ ] Network errors (timeout, no response) show "Could not reach the server — check your connection" with a Retry action
- [ ] 401 errors automatically redirect to the login page with a "Your session has expired" message
- [ ] 403 errors show "You don't have permission to do this" with contact-admin guidance
- [ ] 404 errors on navigation routes show a full-page "Page not found" with a link back to the dashboard
- [ ] Form submission errors display inline next to the relevant field, not just as a toast
- [ ] A global error boundary catches unexpected JS errors and shows a fallback UI with a "Reload" button instead of a white screen
- [ ] All error messages include a suggested next action (retry, go back, contact admin, etc.)

## Technical Notes
- Centralise error parsing in an API client layer that maps HTTP status codes to user-friendly messages
- Use React Error Boundary at the route level so one broken page does not crash the whole app
- Toast notifications (via a toast library or custom) for transient errors; inline errors for form validation
- Log all errors (with stack trace and request context) to the console in dev mode; suppress traces in production UI
- Define an `AppError` type on the backend with `code`, `message`, and optional `field` for structured error responses
