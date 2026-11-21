---
"@gram-lang/parser": patch
---

**Parser**: A comment after the last `@use` that closes a file with no final newline now belongs to the imports, as it already did with one. It used to become a step of the recipe, which `gram format` (adding the newline) then dropped.
