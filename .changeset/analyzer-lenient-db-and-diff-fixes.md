---
"@gram-lang/analyzer": major
"@gram-lang/cli": minor
---

fix!: load valid ingredients even when the database has a bad entry, and fix five correctness bugs (yield, shopping list, diff, nutrition)

**Breaking:**

- `validateIngredientDatabase(rawDb)` no longer validates all-or-nothing and no longer throws. It now validates entry-by-entry and returns `{ data, rejected }`: `data` contains every ingredient that passed schema validation, `rejected` lists the keys (and why) that didn't. Previously, a single malformed entry (e.g. a typo'd density) threw and prevented every other valid ingredient in the file from loading — `gram check`/`gram cook`/etc. would refuse to run over one unrelated bad line. Callers (`loadDb`, `loadSourceDb`, `gram db validate`) now load the valid entries and warn about the rest instead of hard-failing.
- `physical.yield` must now be `> 0` (previously `>= 0`). A `yield: 0` produced `purchasingMass: Infinity` downstream (serialized as `null` in JSON) instead of being rejected as nonsensical at the schema boundary.

**Fixed:**

- `applyYield`: guards against a non-positive `yieldFactor` reaching the division, matching the tightened schema.
- Shopping list aggregation: the `optional` modifier is now an intersection across merged entries, not a union — a required 100g merged with an optional 10g garnish no longer marks the whole merged line as skippable (only `fixed` had this right before).
- `diffRecipes`: a temperature range that changes bounds but keeps the same average (e.g. `{200-300}` -> `{100-400}`) is no longer invisible to the diff — the comparison previously reduced ranges to their average only. Also, two sections sharing the same title no longer silently drop the first section's timer/temperature tokens from the diff (they were overwriting each other in an internal map instead of accumulating).
- `calculateMassMetrics` now excludes `optional` ingredients from `totalMass`, matching `calculateNutrition`'s existing treatment of calories — previously the two disagreed on what counted as "in" the recipe, producing an inconsistent kcal/100g figure.
- `calculateNutrition`: `perPortion.sugar/fiber/sodium` (and their `total` counterparts) now propagate `undefined` when no ingredient in the recipe has that data, instead of a misleading `0` indistinguishable from a genuine zero.
