---
"@gram-lang/analyzer": patch
"@gram-lang/renderer": patch
---

Removed all uses of `any` from the physical/nutrition analysis layer's internal types, typing them against the real shapes already exported by `@gram-lang/kitchen` and this package's own `AnalyzedUsage`/`NutritionItem`. No behavior change for this package beyond the fixes already released separately (see the relative-quantity type changeset). The renderer's printable/PDF view gained one internal `any` to stay compatible with the analyzer's now-stricter shopping-list type — purely a type-level adjustment, no output change.
