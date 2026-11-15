---
"@gram-lang/kitchen": minor
"@gram-lang/renderer": minor
---

**Kitchen & Rendering**: Repeated quantities of an ingredient now add up wherever they can:
  - The shopping list adds up the units of one measuring system into one line, in the smallest unit written (`1 cup` and `2 tbsp` give `18 tbsp`, `1 kg` and `200 g` give `1200 g`), so fewer ingredients are flagged as mixed units and more of them work with `gram scale --target`. Two systems (`1 cup` and `100 ml`) or two kinds of amount still get a line each.
  - A section's ingredient list adds up the quantities of one unit (`100 g` and `100 g` give `200 g`, a quantity taken away comes off its own unit) and keeps different units side by side (`1 cup + 2 tbsp`).
  - Ranges add up by their bounds (`2-3 g` and `200 g` give `202-203 g`, no longer `202.5 g`). A shopping-list entry keeps the middle in `qty` and gains a `range` field with both bounds.
