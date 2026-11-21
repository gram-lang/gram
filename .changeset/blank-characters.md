---
"@gram-lang/parser": patch
"@gram-lang/format": patch
---

**Parser & Formatter**: The parser and `gram format` now agree on what counts as blank, so formatting a recipe no longer splits a step in two or drops its frontmatter:
  - A line holding only spaces or tabs now ends a step, like an empty line. Other invisible characters (a no-break space, U+FEFF) are text, and the formatter keeps them instead of stripping them.
  - A lone carriage return (`\r`) is a line break, as in old Mac files, and the spaces or tabs at the end of a step's line are no longer part of its text.
  - A byte order mark at the start of a file is skipped, so a file saved with one no longer reads its first `##` header as a step. The formatter keeps the mark.
  - The formatter writes every line break as LF and only removes spaces, tabs and line breaks, never another Unicode space.
