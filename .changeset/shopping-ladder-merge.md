---
"@gram-lang/kitchen": minor
"@gram-lang/renderer": minor
---

**Kitchen & Rendering**: The shopping list adds up repeated quantities of an ingredient wherever it can:
  - The units of one measuring system add up into one line, in the smallest unit written (`1 cup` and `2 tbsp` give `18 tbsp`, `1 kg` and `200 g` give `1200 g`), so fewer ingredients are flagged as mixed units and more of them work with `gram scale --target`. Two systems (`1 cup` and `100 ml`) or two kinds of amount still get a line each.
  - Ranges add up by their bounds (`2-3 g` and `200 g` give `202-203 g`, no longer `202.5 g`). A shopping-list entry keeps the middle in `qty` and gains a `range` field with both bounds.
