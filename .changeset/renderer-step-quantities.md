---
"@gram-lang/renderer": minor
---

**Rendering**: Quantities read the same in every format, on screen and on paper:

- The HTML views and the print now write the quantity after its ingredient in the text of each step, as Markdown already did, so a printed recipe shows them too; the tooltip stays on screen
- The weight in grams is written next to the quantity as written in the recipe whenever it tells something more, in the ingredient lists and in the steps alike: `flour (250 ml, ~148 g)`, but `sugar (100 g)` with no repeated badge
- Markdown now shows these weights in grams too
- Hiding the quantities of the steps (`hideStepQty`) now works in the HTML views and the print, not only in Markdown
