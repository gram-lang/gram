---
"@gram-lang/analyzer": minor
---

`convertUnit`, `standardizeMass`, and `analyze()` now accept an optional `lang` parameter/option, so unit names are resolved against the recipe's own language when there's an ambiguity between languages, instead of always falling back to a single global guess.

`UNIT_CONVERSIONS` (the mass/volume conversion table) has moved to `@gram-lang/i18n` — if you imported it from `@gram-lang/analyzer`, import it from `@gram-lang/i18n` instead.
