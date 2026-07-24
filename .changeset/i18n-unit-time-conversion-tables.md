---
"@gram-lang/i18n": minor
---

`@gram-lang/i18n` now also owns the numeric conversion factors for units (grams, milliliters, etc.) and time (minutes, hours, etc.), exported as `UNIT_CONVERSIONS` and `TIME_TO_MINUTES` — previously split across `@gram-lang/analyzer` and hardcoded inside `@gram-lang/kitchen`. No behavior changes; this just puts everything about units and time in one place.
