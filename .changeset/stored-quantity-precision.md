---
"@gram-lang/i18n": patch
"@gram-lang/kitchen": patch
"@gram-lang/analyzer": patch
---

**Kitchen, Analyzer & i18n**: A small quantity is no longer stored as zero. Scaled amounts, shopping list totals, resolved ratios and standardized weights keep two decimals as before, but never fewer than two significant digits:
  - A recipe with `0.02 kg` of salt divided by 10 now asks for `0.002 kg` instead of `0 kg`, and divided by 4 for `0.005 kg` instead of `0.01 kg`.
  - A ratio of a small target (`15 g / L` of a pinch) weighs `0.0047 g` instead of `0 g`, and its standardized weight is no longer left empty.
  - New `roundQuantity` in `@gram-lang/i18n` (and re-exported by `@gram-lang/kitchen`).
