---
"@gram-lang/format": minor
---

Fixed two bugs in the recipe formatter:

- A `#cookware` reference at the very start of a line (e.g. `#pan(20cm)`) was incorrectly treated as a malformed section header and got a space inserted after the `#`, turning it into plain text and silently breaking the recipe.
- Blank-line spacing before a `## Section` header was being promoted to two blank lines instead of Gram's actual convention of exactly one blank line between every step and/or section. The formatter now consistently enforces a single blank line everywhere, including before section headers. As a result, the `sectionSpacing` counter (previously reported alongside `consecutiveBlankLines`) has been removed — this kind of spacing fix is now reported as part of `consecutiveBlankLines`.
