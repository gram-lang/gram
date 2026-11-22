---
"@gram-lang/kitchen": patch
"@gram-lang/analyzer": patch
"@gram-lang/renderer": patch
---

**Kitchen, Analyzer & Renderer**: A composite parent's amounts in the shopping list now add up only within one unit:
  - `@butter{100 g}` next to `@brown butter{1}<@butter{2}` no longer buys "102 butter": the parent gets one entry per unit (100 g, then 2), each with the parts drawn in that unit and marked `multiUnit`, like any ingredient bought in two units. Grams and kilograms still add up in one entry.
  - A parent used directly in two units no longer loses the first one: each direct use is kept in its own unit.
  - A composite entry now carries its unit (`"unit": "g"`), so the views show "100 g" instead of "100", and the parent can be a scale target in that unit.
  - Every view lists each entry of such a parent, and `diffRecipes` pairs them by unit.
