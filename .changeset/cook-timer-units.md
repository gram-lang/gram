---
"@gram-lang/cli": patch
---

**CLI / Cook**: The countdown of a timer in `gram cook` now lasts as long as the recipe says: `~{1h}` used to count down 1 minute and `~{30 s}` 30 minutes, because every timer was read as minutes whatever its unit.
