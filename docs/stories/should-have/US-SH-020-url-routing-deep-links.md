## User Story

As a user, I want URL-based navigation so that I can bookmark, share, and directly access specific views in Hive.

## Complexity
M (Medium)

## Priority
P1

## Dependencies
- react-router (#54)

## Acceptance Criteria
- [ ] /rooms/:id loads the specific room and selects it in sidebar
- [ ] /agents shows the agent management view
- [ ] /settings shows settings page
- [ ] Browser back/forward buttons work correctly
- [ ] URLs are shareable (opening a shared URL loads the correct view)
- [ ] 404 page for invalid routes
- [ ] Redirect to login if unauthenticated
