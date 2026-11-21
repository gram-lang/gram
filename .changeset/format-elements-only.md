---
"@gram-lang/format": patch
---

**Formatter**: `gram format` and format-on-save now only rewrite the ingredients, references, cookware, timers, temperatures and target states the parser finds, so they no longer change text the author wrote:
  - A section title (`## Dough {1.0}`, `## @Dough`), a preparation (`@egg(beat {  } well)`, `#pan(5@L)`), a comment or plain braces in a step stay as written.
  - Ids are still lowercased and quantities still tidied (`@Flour {500.0 g}` → `@flour{500 g}`), as are the offset and bindings of an `@use`.
  - A file that does not parse is only repaired (`< @`, `->&name {}`, `##Title`) and cleaned of trailing blanks, instead of being rewritten blindly.
