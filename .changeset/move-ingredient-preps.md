---
"@gram-lang/kitchen": minor
"@gram-lang/renderer": minor
---

Improve ingredient preparation tracking and display.

- **Kitchen**: `aggregateSectionIngredients` now groups ingredients by both `id` and `preparation`, creating separate entries for the same ingredient if it requires different preparations (e.g. cold vs melted).
- **Renderer**: A new `formatMode` option in the render context controls preparation rendering. Preparations remain visible in inline text to prevent information loss. In the section's ingredient list (Mise-en-place), they are cleanly displayed with an em-dash. In the global shopping list, they remain hidden.
