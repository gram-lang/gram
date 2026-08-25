---
"@gram-lang/renderer": minor
"@gram-lang/docs": patch
"gram-lang": minor
---

**Nutrition & Rendering**: Replaced Phosphor icon webfonts with native inline SVG elements:
  - Rendered recipes now embed self-contained SVG paths directly in HTML, eliminating the external CDN dependency on `unpkg.com`.
  - Expanded `DEFAULT_ICONS.html` and `DEFAULT_ICONS.md` to cover all 18 renderer icons with full support for custom overrides.
  - Enabled full offline recipe previews in the VS Code extension without external network requests.
