---
"@gram-lang/analyzer": patch
---

Fixed mass standardization silently failing for alternative ingredient groups. Mass and estimate metrics are now properly computed for each option independently, fixing missing totals in the shopping list.
