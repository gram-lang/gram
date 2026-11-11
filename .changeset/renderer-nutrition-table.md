---
"@gram-lang/renderer": minor
"@gram-lang/i18n": minor
"@gram-lang/cli": minor
"gram-lang": minor
---

**Nutrition & Rendering**: The nutrition of the HTML recipe is now a compact table, like a European food label, and easy to reach from the top of the recipe:

- One column per basis, side by side (per 100 g, then per portion), with the energy as the first row in kJ and kcal and the whole recipe underneath; no more switching between bases
- A `%RI` column gives each nutrient's share of the reference intake of an average adult (8,400 kJ / 2,000 kcal), per portion
- The hero bar shows the energy (`493 kcal per portion`, or per 100 g when the recipe declares no portions); clicking it jumps to the table
- Sodium is now shown as salt, in grams (sodium × 2.5), and calories as energy, in every view and every language: the HTML and printed recipe, Markdown, plain text and the terminal
- With the `nutritionBasis` setting set to one basis, the table and the hero bar show that basis alone
- The Markdown and plain text recipes show the same table by default (per 100 g and per portion side by side, the `%RI` column and the whole recipe underneath), instead of the values per portion only
- **Deprecated**: the `interactiveNutrition` option of the renderer no longer has any effect, since every basis is shown at once. Remove it; it will be removed in 2.0.0
