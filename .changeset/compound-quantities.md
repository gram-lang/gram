---
"@gram-lang/parser": minor
"@gram-lang/kitchen": minor
"@gram-lang/modules": minor
"@gram-lang/analyzer": minor
"@gram-lang/renderer": minor
"@gram-lang/cli": minor
---

**Parser & Kitchen**: An ingredient's quantity can be written as a sum, the way American recipes measure: `@flour{1 cup + 1 tbsp}`, `@sugar{1 cup - 2 tbsp}`, `@butter{1 cup + 20 g}`:
  - Any number of terms, added with `+` or taken away with `-`, each with its unit; a term can be a fraction or a range (`{1 cup + 1-2 tbsp}`). It works for an ingredient, a composite parent (`<@oranges{1 lb + 4 oz}`) and a reference (`&dough{1 kg + 200 g}`, which also sets how much of a `@use` base is made). These sums used to be a syntax error.
  - A sum counts exactly as its terms written one after the other: one kind of amount adds up into one total, exactly (`1 cup + 1 tbsp` is 17 tbsp, a range by its bounds), and is usable with `gram scale --target`; a volume and a weight (`1 cup + 20 g`) stay two lines of the shopping list. Scaling multiplies each term. A step shows a sum as written; a section lists each mention as written (`100 g + 100 g`, two portions to weigh); a scaled amount and the shopping list are written the way a cook measures (`2 cup + 2 tbsp`, never `2 1/8 cup` or `34 tbsp`; `2.4 kg` in a step, `1.5 kg` to buy), for any amount, not only sums, in the views as in `gram shop` and `gram scale`; the renderer's new `formatUsageQuantity` writes an amount this way for other tools.
  - Gram never guesses: a term without a unit, a percentage, a multiplication, a range taken away, a subtraction from another kind of amount or a sum that comes to nothing raises the new `INVALID_QUANTITY` warning, with the result to write when it can tell (`{100 g + 10%}` suggests `{110 g}`), and the sum is not counted. The new `OZ_AFTER_VOLUME` note says that `oz` is a weight in `{1 cup + 2 oz}`, and `INVALID_UNIT` now asks for two quantities written side by side (`{1 kg 200 g}`) to be written as a sum.
  - In the compiled JSON, a sum keeps its terms in a new `parts` field (`minus: true` on a term taken away), and its total in `qty` / `unit` as before; a sum of several kinds of amount keeps its text in `unit`, like a quantity written in words. A warning that a tool can act on carries a new `data` field (its reason and suggestion).
  - Masses and nutrition weigh a sum by its parts: `@flour{1 cup + 20 g}` weighs its cup (with the flour's density) plus its 20 g, a term taken away weighs against the total, and a sum with a part Gram cannot weigh gets no mass rather than a partial one. `gram diff` shows amounts as the shopping list writes them (`1 cup + 1 tbsp → 1 cup + 3 tbsp`, `202-203 g`), from the new `fromText` / `toText` fields of an ingredient change.
