---
"@gram-lang/cli": patch
"@gram-lang/renderer": patch
---

**CLI / View**: Fixed several display issues in `gram view` and cook mode:

- Timers now show their real unit (`~{1h}` is shown as `~1h`, `~{20s}` as `~20s`) instead of always "min".
- Recipe durations are rounded and readable (`1h 5m`, `25m 5s`) instead of raw decimals like `1h4.5`.
- The resting time now appears in the recipe header.
- Common fractions such as `1/4 tsp` stay fractions in the shopping list instead of becoming `0.3`.
