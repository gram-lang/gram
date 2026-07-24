---
"@gram-lang/analyzer": patch
---

Fixed the same ingredient sometimes getting two different `normalizedMass` values in one analyzed recipe (e.g. `250.78328000000002` in a recipe section vs. `250.78` in the shopping list) — the section-level and composite-child mass calculations now go through the same rounding as the shopping list, instead of duplicating the sequence without it.
