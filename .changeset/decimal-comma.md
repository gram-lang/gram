---
"@gram-lang/parser": minor
"@gram-lang/kitchen": minor
"@gram-lang/i18n": minor
"@gram-lang/format": minor
---

**Parser & Kitchen**: Decimal numbers can be written with a comma as well as a point, so `{1,5 kg}` and `{1.5 kg}` are the same quantity:
  - Works in every number in braces: ingredients, ranges, relative quantities (`{12,5% &dough}`), cookware, temperatures, timers and section anchors. Scaling, masses and the schedule read it like any other number.
  - Gram has no thousands separator. A comma followed by exactly three digits (`{1,000 g}`) is still read as a decimal (1 g), with a new `AMBIGUOUS_NUMBER` warning saying how it was read, in case a thousand was meant. A point keeps its meaning: `{1.000 kg}` is 1 kg, with no warning.
  - `gram fmt` removes trailing zeros after a comma too (`{1,50}` → `{1,5}`), but leaves `{1,000}` as written.
  - Numbers written with a comma are shown in the reader's language like the others (`1,5` → `1.5` in English).
