# CH-016: Emoji Picker

**As a** room participant, **I want to** insert emojis into messages via a searchable picker, **so that** I can express reactions and add visual context quickly without memorizing emoji codes.

**Complexity:** S
**Priority:** P3
**Phase:** Can Have

## Dependencies
- Web frontend message input component
- None (self-contained UI enhancement)

## Acceptance Criteria
- [ ] Emoji picker opens via a button in the message input area or a keyboard shortcut
- [ ] Picker displays emojis organized by category (smileys, people, animals, objects, symbols, flags)
- [ ] Search-as-you-type filters emojis by name and keywords
- [ ] Recently used emojis are shown in a "Frequent" tab (persisted in local storage)
- [ ] Clicking an emoji inserts it at the cursor position in the message input
- [ ] Shortcode support: typing `:thumbsup:` auto-suggests and converts to the emoji
- [ ] Emoji renders correctly in sent messages across all browsers
- [ ] Picker is keyboard-navigable (arrow keys to browse, Enter to select, Escape to close)
- [ ] Skin tone selector for applicable emojis
- [ ] Unit tests cover emoji search and shortcode resolution
- [ ] Accessibility: picker has ARIA labels and is screen-reader compatible

## Technical Notes
- Use an existing emoji picker library (e.g., emoji-mart) to avoid reimplementing the catalog
- Emoji data should be lazy-loaded to avoid bloating the initial bundle
- Store recent emojis in localStorage (top 30, LRU eviction)
- Ensure emojis are stored as native Unicode in messages, not as shortcodes
