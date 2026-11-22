---
"@gram-lang/kitchen": patch
"@gram-lang/analyzer": patch
---

**Kitchen & Analyzer**: A shopping list entry Gram cannot count yet, such as a ratio whose target is missing or has no weight, or a share of another ingredient, is now written from the numbers Gram read rather than copied from the source, so `gram format` no longer changes it:
  - A ratio reads `1,5 / 100 g @&flour`, with trailing zeros and extra spaces dropped. A denominator of 1 is left out (`15 g / L @&water`).
  - A share keeps the decimal comma its author wrote (`12,5% of flour`, no longer `12.5% of flour`).
