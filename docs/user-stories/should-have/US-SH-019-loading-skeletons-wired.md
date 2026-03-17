## User Story

As a user, I want to see skeleton loading indicators while data is being fetched so that the UI feels responsive and I know content is loading.

## Complexity
S (Small)

## Priority
P2

## Dependencies
- Skeleton components (#63)

## Acceptance Criteria
- [ ] Room list shows skeleton during initial fetch
- [ ] Chat timeline shows skeleton while loading message history
- [ ] Agent list shows skeleton during fetch
- [ ] Smooth transition from skeleton to actual content (no layout shift)
- [ ] Skeletons match the layout of the final rendered content
- [ ] Error state shown if fetch fails (not stuck on skeleton)
