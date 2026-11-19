---
"@gram-lang/analyzer": patch
"@gram-lang/kitchen": patch
---

**Analyzer & Kitchen**: Percentages inside alternatives (`@butter{10% @&flour}|@oil{8% @&flour}`) are now resolved per option (including references to earlier options in the same group) without summing across alternatives, and `detectCycles` now traverses alternative formulas.
