---
"@gram-lang/renderer": minor
---

**Renderer / Settings**: The renderer now describes, in one place, every setting a reader can choose about a recipe, so that tools built on Gram can offer the same choices as the command line, the editor and the playground:

- `VIEW_SETTINGS` lists what the views show (mise en place, rests, comments, nutrition basis, baker's percentages only, quantities in the steps) and `RECIPE_SETTINGS` what the analyzer computes (baker's percentages, weights in grams, preparation losses, nutrition), each with its values, its default and a short description
- `parseViewSettings()` and `parseRecipeSettings()` read them from any configuration object, and fall back on the default for anything missing or unknown, so a mistyped setting never blanks a view
- `viewSettingsToRendererOptions()` and `recipeSettingsToAnalyzerOptions()` turn them into the options of the renderer and of the analyzer
