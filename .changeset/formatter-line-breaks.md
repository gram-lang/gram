---
"@gram-lang/format": patch
---

**Formatter**: `gram format` and format-on-save no longer join text across a line break, which could change a recipe or break it:
  - `Add @flour` followed by `{200 g}` on the next line stays an ingredient with no amount, instead of becoming `@flour{200 g}`.
  - A `{` left open at the end of a line is left alone, instead of being joined to the next line into a file that no longer parses.
  - Braces spread over several lines no longer pull a step into the section header above it or merge two steps.
  - Formatting a file full of unclosed braces now takes time in step with its length, instead of growing with its square.
