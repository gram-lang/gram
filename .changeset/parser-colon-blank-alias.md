---
"@gram-lang/parser": patch
---

**Parser**: A colon written right after a bare ingredient or cookware at the end of a line (`Add @salt: ` then a line break) is now kept in the step's text. The blanks after it were read as an empty alias and the colon vanished, while `@salt:` with no blank kept it, so `gram format` removing a trailing blank changed the recipe.
