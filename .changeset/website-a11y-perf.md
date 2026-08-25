---
"@gram-lang/docs": patch
"@gram-lang/i18n": patch
---

**Documentation & Playground**: Improved accessibility and performance across the website and the interactive playground:
  - Added proper ARIA roles and labels to the homepage's interactive mockups, the playground's file tabs, and its export-format dropdown, so they read correctly with a screen reader and support keyboard navigation (arrow keys, `Delete` to close a tab, focus restored after closing).
  - Added `prefers-reduced-motion` support and visible focus outlines across the homepage and playground.
  - Fixed a handful of small display issues in the playground's editor, output panel, and warnings console.
