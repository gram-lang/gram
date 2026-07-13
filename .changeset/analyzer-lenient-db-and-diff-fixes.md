---
"@gram-lang/analyzer": major
"@gram-lang/cli": minor
---

fix!: load valid ingredients even when the database has a bad entry, and fix five correctness bugs

**Breaking:**
- `validateIngredientDatabase` no longer throws an error on a single malformed entry. It now validates entry-by-entry, returning both valid data and rejected keys. This prevents `gram check` or `gram cook` from hard-failing due to one unrelated bad line.
- `physical.yield` must now be `> 0` (previously `>= 0`) to prevent producing `Infinity` mass downstream.

**Fixed:**
- Added a guard in `applyYield` against non-positive yield factors.
- Shopping list aggregation: The `optional` modifier is now treated as an intersection rather than a union.
- `diffRecipes`: Temperature ranges that change bounds but keep the same average are now correctly detected in the diff. Fixed an issue where identical section titles would drop timer/temperature tokens.
- `calculateMassMetrics`: Excludes `optional` ingredients from `totalMass` to match nutritional calculations.
- `calculateNutrition`: Missing nutrient data now propagates as `undefined` rather than an indistinguishable `0`.
