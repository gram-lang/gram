---
"@gram-lang/kitchen": patch
"@gram-lang/renderer": patch
"@gram-lang/analyzer": patch
"@gram-lang/cli": patch
---

**Kitchen, Rendering & CLI**: Fixed quantities that were lost or split when an ingredient is used in several units or spellings:
  - The shopping list adds up the spellings of one unit (`1 cup` and `2 cups`, `1 c.à.s` and `2 tbsp`) into one line, which also makes the ingredient usable again with `gram scale --target`.
  - The HTML view shows every quantity of an ingredient used in two units within a section (`100 g + 1 cup`), instead of only the first one.
  - `gram shop` no longer drops an ingredient with a quantity it cannot compute, such as a percentage of a missing intermediate: it is listed as written.
  - `gram diff` compares each unit of an ingredient bought in two units, so a change to either one shows, and no longer reports a change when only the spelling of a unit changed.
