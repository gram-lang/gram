---
"@gram-lang/parser": minor
"@gram-lang/kitchen": minor
"@gram-lang/i18n": minor
"@gram-lang/modules": minor
"@gram-lang/analyzer": minor
"@gram-lang/renderer": minor
"@gram-lang/cli": minor
---

**Parser & Kitchen**: An ingredient or intermediate quantity can now be written as a sum or difference of terms (`@flour{1 cup + 1 tbsp}`, `@sugar{1 cup - 2 tbsp}`, `@butter{1 cup + 20 g}`, `&dough{1 kg + 200 g}`):
  - Supports any number of `+`/`-` terms (including fractions and ranges) on ingredients, composite parents (`<@oranges{1 lb + 4 oz}`), and intermediates (including `@use` base yields); scaling multiplies each term, and `gram import` now preserves multi-measure sums instead of folding them into decimals.
  - Steps and section ingredient lists keep sums as written (`100 g + 100 g`), while scaled amounts format cleanly for cooking (`2 cup + 2 tbsp`, `2.4 kg`); compiled JSON stores terms in `parts` (with `minus: true` for subtraction) and totals in `qty`/`unit` (or full text in `unit` for mixed unit kinds).
  - Invalid sums (missing unit, percentage, multiplication, subtracting a range or across unit kinds, zero total) raise `INVALID_QUANTITY` with a suggestion in `data`; `OZ_AFTER_VOLUME` flags `oz` after a volume (`{1 cup + 2 oz}`), and `INVALID_UNIT` suggests a sum for adjacent quantities (`{1 kg 200 g}`).
  - Masses and nutrition weigh each term individually (returning no mass if any term cannot be weighed), `gram diff` shows formatted quantities via `fromText`/`toText`, `@gram-lang/renderer` exports `formatUsageQuantity`, and `@gram-lang/i18n` exports `termsTotal`, `mergeTerms`, `formatTerms`, and `Term`.
