---
"@gram-lang/kitchen": minor
"@gram-lang/renderer": minor
---

**Kitchen & Rendering**: The shopping list adds up repeated quantities of an ingredient wherever it can:
  - The units of one measuring system add up into one line, written the way a cook measures (`1 cup` and `2 tbsp` give `1 cup + 2 tbsp`, `1 kg` and `200 g` give `1.2 kg`), so fewer ingredients are flagged as mixed units and more of them work with `gram scale --target`.
  - Two systems (`1 cup` and `100 ml`) or two kinds of amount (a volume and a weight) still get a line each.
  - Ranges add up by their bounds (`2-3 g` and `200 g` give `202-203 g`, no longer `202.5 g`).
  - In the compiled JSON, a shopping-list entry keeps its total in the smallest unit written (`18 tbsp`, `1200 g`) and, for a range, the middle in `qty` with a new `range` field giving both bounds.
