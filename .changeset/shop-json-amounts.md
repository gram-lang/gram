---
"@gram-lang/cli": minor
---

**CLI / Shop**: `gram shop --format json` now exposes numeric ingredient amounts alongside the formatted `qty` string:
  - Adds `amount` (numeric value in the displayed unit) and canonical `unit` (`null` for counts).
  - Adds `range` bounds when an entry is a range (with the midpoint in `amount`).
  - Lists unmerged unit groups in `parts` and non-numeric quantities in `unresolved` (excluded from `amount`).
