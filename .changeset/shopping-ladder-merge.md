---
"@gram-lang/kitchen": minor
"@gram-lang/renderer": minor
---

**Kitchen & Rendering**: The shopping list merges repeated quantities of an ingredient wherever possible:
  - Units from the same measuring system combine onto one line in natural cooking units (`1 cup` and `2 tbsp` become `1 cup + 2 tbsp`; `1 kg` and `200 g` become `1.2 kg`), reducing mixed-unit warnings and supporting `gram scale --target`.
  - Different measuring systems (`1 cup` and `100 ml`) or unit kinds (volume and weight) stay on separate lines.
  - Ranges add by their bounds (`2-3 g` and `200 g` become `202-203 g` instead of `202.5 g`).
  - In compiled JSON, merged entries store the total in the smallest unit written (`18 tbsp`, `1200 g`) and, for ranges, keep the midpoint in `qty` alongside a new `range` field.
