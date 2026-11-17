---
"@gram-lang/parser": patch
"@gram-lang/kitchen": patch
---

**Parser & Kitchen**: A fraction over zero (`@flour{1/0 cup}`) no longer vanishes without a word:
  - It raises an `INVALID_QUANTITY` warning (`reason: "zeroDenominator"`), shown in the editor, on ingredients, sums, percentages, cookware and temperatures.
  - The number is left out, as if none had been written: `{1/0% &dough}` no longer counts as 1%, and a mixed fraction such as `{1 1/0 cup}` no longer gives an empty number.
  - The AST keeps the refused number as written in `invalidNumber`, for tools that need it.
