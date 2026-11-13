---
"@gram-lang/renderer": patch
"@gram-lang/cli": patch
"@gram-lang/i18n": patch
---

**Rendering & CLI**: Large amounts are now written in kilograms and liters where you buy or read a total, and stay in grams where you weigh:
  - The shopping list writes 1000 g or more in kg and 1000 ml or more in l (`3.9 kg` of flour rather than `3900 g`), in the recipe view and in `gram shop`.
  - The weight of the recipe, of each section and the weight the nutrition is based on follow the same rule.
  - Steps, the ingredients of a section and the run sheet keep grams, as a kitchen scale shows them; `gram cook` now shows the masses you weigh in grams, like the steps of the recipe view.
  - A quantity you wrote and that nothing changed is always shown as written. Integrators can use the same rule through `toLargerMetricUnit` and `isMetricMassUnit` in `@gram-lang/i18n`.
