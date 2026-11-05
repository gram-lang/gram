---
"@gram-lang/language-server": minor
"gram-lang": minor
---

**Language Server / VS Code**: The editor now offers every setting of a recipe, with the same values and default as the command line and the playground:

- `gram.stepQuantities` writes the quantities in the text of the steps, or leaves them out
- `gram.nutritionBasis` pins the basis of the nutrition panel (`auto`, the default, keeps the switch in the preview)
- `gram.bakersMathOnly` shows only the baker's percentages
- `gram.bakersMath`, `gram.massStandardization`, `gram.yieldCalculation` and `gram.nutritionEstimation` choose what is computed from the ingredient database; all are on by default, and changing one analyzes every open recipe again
