---
"@gram-lang/language-server": minor
---

**Language Server**: Three new editing aids, in every editor that speaks the LSP:
  - The path of an `@use "…"` is now a link to the module it imports (`Ctrl+Click`), aliases such as `@/` included; a module that cannot be found gets no link.
  - Completion now offers a module's exports on an `@use` line: its default export after `as &`, and inside `as { … }` the sections it exports that are not bound yet, even while the line is still incomplete.
  - With the cursor on an ingredient, a `&reference` or a `->&` declaration, the editor highlights every other occurrence in the file, including the targets of ratios and percentages (`{2% @&flour}`, `{10% &dough}`) and the names bound by `@use`.
