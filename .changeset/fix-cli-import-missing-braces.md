---
"@gram-lang/cli": patch
---

Fixed `gram import`'s AI prompt teaching a broken pattern by example: three of its own reference examples used a multi-word cookware name (`#loaf pan(...)`, `#tart tin(...)`, `#kitchen torch`) without the required trailing `{}`, which — per Gram's own syntax rules — silently truncates the name to its first word and leaks the rest into the recipe's step text instead of raising an error. The examples now use the correct `{}` syntax, and the prompt's own pre-output review checklist now explicitly calls out this rule, so the AI is less likely to reproduce the same mistake on ingredient names like `@boneless chicken breast`.
