---
"@gram-lang/parser": patch
---

**Parser**: `gram format` no longer turns a section header into a step and adds a tool named `#` to the recipe and its shopping list:
  - A `##` with no title after it is now an untitled section, like `## ` already was (the formatter strips the space after it). The editor highlights it as a header too.
  - Empty anchor braces (`## Dough ~{}`, as the formatter writes `~{ }`) stay an anchor, with the same missing-unit warning, in a header and in an `@use`.
  - A declaration followed by an anchor (`->&dough ~{}`) declares `dough`, instead of an intermediate named `dough ~`.
