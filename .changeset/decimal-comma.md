---
"@gram-lang/parser": minor
"@gram-lang/kitchen": minor
"@gram-lang/i18n": minor
"@gram-lang/format": minor
---

**Parser & Kitchen**: Decimal numbers can now be written with a comma as well as a point (`{1,5 kg}` and `{1.5 kg}`):
  - Supported in all braced numbers (ingredients, ranges, relative quantities, cookware, temperatures, timers, and section anchors) and displayed in the reader's locale.
  - Commas followed by exactly three digits (`{1,000 g}`) are still read as decimals (`1 g`), with a new `AMBIGUOUS_NUMBER` warning in case a thousand was intended (while `{1.000 kg}` remains `1 kg` without warning).
  - `gram format` trims trailing zeros after a comma (`{1,50}` → `{1,5}`) while keeping `{1,000}` as written.
