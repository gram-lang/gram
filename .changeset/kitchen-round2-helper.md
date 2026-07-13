---
"@gram-lang/kitchen": minor
---

Add `round2(value: number): number`, exported from `@gram-lang/kitchen`. It centralizes the 2-decimal rounding rule (`parseFloat(x.toFixed(2))`) previously duplicated across kitchen, analyzer, and renderer, giving quantity/mass rounding a single documented implementation. No observable output changes — same rounding rule as before, just in one place.
