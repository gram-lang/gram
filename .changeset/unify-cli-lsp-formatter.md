---
"@gram-lang/cli": minor
"@gram-lang/language-server": minor
---

`gram format` and the editor's "format on save" now share the exact same formatting rules, so a recipe formatted by one always looks identical when opened in the other.

This adds a few new automatic cleanups to both: normalizing spacing around composite ingredients (`@a{} < @b{}` → `@a{}<@b{}`), tidying up intermediate-result declarations (`->&name {}` → `->&name{}`), making sure section headers have exactly one space after the `#`s, and converting tabs to spaces.
