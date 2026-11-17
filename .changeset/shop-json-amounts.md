---
"@gram-lang/cli": minor
---

**CLI / Shop**: `gram shop --format json` gives each ingredient's amount as numbers, next to the `qty` text that stays unchanged:
  - `amount` is a plain number, in the unit `qty` shows (`3.9` for `3,9 kg`), and `unit` the canonical unit (`tbsp` for `tablespoons` or `c. à s.`), `null` for a count.
  - `range` gives the bounds of a range, whose middle is in `amount`.
  - `parts` lists the amounts whose units do not add up (`1 1/2 cups + 70 g`), and `unresolved` what could not be turned into a number, never counted in `amount`.
