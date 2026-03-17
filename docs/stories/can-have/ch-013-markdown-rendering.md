# CH-013: Markdown Rendering + Code Block Syntax Highlighting

**As a** room participant, **I want to** see messages rendered with Markdown formatting and syntax-highlighted code blocks, **so that** technical discussions are readable and code snippets are easy to review.

**Complexity:** M
**Priority:** P2
**Phase:** Can Have

## Dependencies
- Web frontend message rendering component
- None (self-contained UI enhancement)

## Acceptance Criteria
- [ ] Messages containing Markdown are rendered with: headings, bold, italic, lists, links, tables, and blockquotes
- [ ] Fenced code blocks (triple backtick) are rendered with syntax highlighting
- [ ] Language detection from code fence labels (```rust, ```python, etc.) applies correct highlighting
- [ ] Inline code (`backticks`) is rendered in monospace with a subtle background
- [ ] Raw message source is accessible via a "view source" toggle on each message
- [ ] Markdown rendering is sanitized to prevent XSS (no raw HTML injection)
- [ ] Rendering does not break message layout (long lines wrap, tables scroll horizontally)
- [ ] Syntax highlighting supports at least: Rust, Python, JavaScript/TypeScript, Go, JSON, YAML, TOML, Bash, SQL
- [ ] Performance: rendering 100 messages with code blocks completes within 500ms
- [ ] Users can copy code blocks with a one-click "copy" button
- [ ] Unit tests cover Markdown sanitization (XSS prevention)
- [ ] Visual regression tests verify rendering of each supported Markdown element

## Technical Notes
- Use a battle-tested Markdown library (e.g., react-markdown + remark-gfm for GFM support)
- Syntax highlighting via Prism.js or highlight.js (tree-shakeable for bundle size)
- Sanitization: use an allowlist approach (only permit safe HTML elements)
- Consider lazy rendering for long messages (render visible portion first)
