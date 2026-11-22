---
"@gram-lang/i18n": patch
"@gram-lang/renderer": patch
"@gram-lang/cli": patch
---

**Renderer, CLI & i18n**: Quantities are now shown rounded to their size rather than to a fixed decimal of their unit, which showed some of them wrong or as zero since 1.4.0:
  - `0.15 kg` reads `0.15 kg` instead of `0.2 kg`, `0.05 l` reads `0.05 l` instead of `0.1 l`, and `0.02 kg` or `0.03 g` no longer read `0`.
  - An amount keeps three significant digits (two below 1), never fewer than its whole part: `1.15 kg`, `15.2 g`, `152 g`. Kitchen fractions (`1/2 cup`) are unchanged.
  - A weight in grams keeps one decimal from 1 g upwards, and is no longer shown as `0 g` below 0.05 g.
  - New `formatAmount`, `roundAmount` and `amountDecimals` in `@gram-lang/i18n`.
