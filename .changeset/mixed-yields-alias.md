---
"@gram/analyzer": minor
"@gram/renderer": minor
"@gram/cli": patch
---

Fixed several correctness bugs found during a documentation audit, and added alias-aware cross-unit shopping list aggregation.

- **@gram/analyzer**: `unit_weight`-based conversions (e.g. `@avocado{1}`) were being double-divided by `yield` — the whole-unit weight is now correctly treated as Gross Mass, with Net Mass derived forward (`Gross × yield`), while explicit mass/volume entries keep deriving Gross backward (`Net ÷ yield`) as before. Optional ingredients (`?`) are no longer counted in nutrition totals. New `resolveCanonicalId()` resolves an ingredient name/alias to its database key, and a new `aggregateShoppingList()` step re-groups the shopping list by canonical id — merging aliased ingredients (e.g. `beurre`/`butter`) and cross-unit quantities (e.g. `100g` + `1 cup`) into a single gram total whenever every entry resolves to a mass, falling back to separate entries flagged `multiUnit: true` when a density is missing.
- **@gram/renderer**: The HTML shopping list now clusters consecutive `multiUnit`-flagged entries for the same ingredient under one heading with a "⚠️ Mixed units" badge, instead of listing them as unrelated lines.
- **@gram/cli**: `shopper`'s alias resolution now reuses `@gram/analyzer`'s `resolveCanonicalId()` instead of a separate, duplicated alias map.