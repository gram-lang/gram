---
"@gram-lang/parser": patch
---

**Parser**: A file holding only blank lines, or only a frontmatter or `@use` lines followed by a blank line, now parses as an empty recipe instead of failing with a syntax error. Since formatting an empty file gives it a final newline, a new `.gram` file no longer shows an error in the editor after its first save.
