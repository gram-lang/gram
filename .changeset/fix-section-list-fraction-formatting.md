---
"@gram-lang/renderer": patch
---

**Fix: Scaled fractions below 1 showed a raw decimal in the section ingredient list instead of a fraction**

The shopping list already reformats a scaled decimal quantity back into a common fraction (e.g. `0.5` → `"1/2"`) via `formatDecimalToFraction`. The section ingredient list and reference/tooltip displays instead fell back to `String(qty.value)`, so a scaled `@sel{1/4 tsp}` (×2 → `0.5`) showed "0.5 tsp" there while the shopping list showed "1/2 tsp" for the same ingredient.

These display paths now share `formatDecimalToFraction` for their fallback, so both views render the same fraction for a given scaled value.
