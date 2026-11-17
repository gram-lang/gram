---
"@gram-lang/analyzer": patch
"@gram-lang/kitchen": patch
---

**Analyzer & Kitchen**: A percentage inside an alternative (`@butter{10% @&flour}|@oil{8% @&flour}`) is now calculated instead of staying unresolved without a word: each option gets its own amount, shown in the views and the shopping list and never added to the other options, and an option can take a share of an earlier option of the same group (`@butter{100 g}|@oil{80% @&butter}`). `detectCycles` now follows the options' formulas too.
