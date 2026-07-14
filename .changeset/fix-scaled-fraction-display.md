---
"@gram-lang/kitchen": patch
---

**Fix: Scaled fraction/decimal quantities showed the original, unscaled value in the section ingredient list**

`scaleQty()` updated a quantity's numeric `value` when applying a scale factor, but left the original source `text` (e.g. `"1/2"`) untouched on the returned object. The shopping list always derives its display string from the scaled `value`, so it rendered correctly — but the section ingredient list (and reference/tooltip displays) preferred the stale `text` over `value`, so a scaled `@sel{1/2 tsp}` still showed "1/2 tsp" there after doubling, even though the shopping list and the computed mass both updated correctly.

`scaleQty()` now clears `text` (and `numerator`/`denominator` for fractions) whenever it scales a quantity, so all display paths fall back to the correct, scaled `value`.
