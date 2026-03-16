# [FE-024] Loading States and Skeleton Screens

**As a** Hive user
**I want to** see skeleton placeholders while data loads
**So that** the UI feels responsive and I know content is coming rather than seeing blank screens

## Acceptance Criteria
- [ ] Room list sidebar shows 5 skeleton rows (pulsing gray rectangles) while rooms are loading from the API
- [ ] Chat timeline shows 8 skeleton message bubbles while history is fetching
- [ ] Agent grid shows 4 skeleton cards while agent list loads
- [ ] Task board shows skeleton columns with placeholder cards while taskboard data loads
- [ ] Member panel shows skeleton avatar circles while participant list loads
- [ ] Skeleton screens transition smoothly to real content (fade-in, no layout shift)
- [ ] If loading takes >5 seconds, a "Taking longer than expected..." message appears below the skeletons
- [ ] Empty states (no rooms, no agents, no tasks) show helpful messages with action buttons — not confused with loading states

## Phase
Phase 1: Web Dashboard MVP

## Priority
P1

## Components
- SkeletonRow
- SkeletonCard
- SkeletonMessage
- EmptyState

## Dependencies
- FE-001 (App Shell) — layout must exist before skeletons can render in panels

## Notes
Skeleton screens are a UX best practice for perceived performance. Use Tailwind's `animate-pulse` on gray placeholder elements. The key distinction is loading (skeletons) vs empty (helpful message + CTA). Each view component should handle both states internally.
