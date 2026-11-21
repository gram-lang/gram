---
"@gram-lang/parser": patch
---

**Parser**: An element no longer runs over a line break and keeps it, which `gram format` writes as LF and so changed a recipe saved with Windows (CRLF) or old Mac line breaks:
  - An action (`[Mix well]`), the text of a temperature (`^{low heat}`) and the anchor of a section (`~{-1d}`) now end on their line, like every other element. An unclosed `[` or `^{` is left in the step's text.
  - A block comment (`/* … */`) may still span lines, and reads every line break as LF.
