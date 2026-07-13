---
"@gram-lang/kitchen": patch
"@gram-lang/cli": patch
---

Fixed a bug in `applyScale()` where scaled quantities were incorrectly squared instead of multiplied for inline step ingredients, resulting in incorrect values (e.g., displaying `800g` instead of `400g` when using `--scale 2`). The aggregated shopping list was unaffected.
