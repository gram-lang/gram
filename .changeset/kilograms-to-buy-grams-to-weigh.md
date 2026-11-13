---
"@gram-lang/renderer": patch
"@gram-lang/cli": patch
"@gram-lang/i18n": patch
---

**Rendering & CLI**: Large amounts are now written in kilograms and liters where you buy or read a total, and stay in grams where you weigh:
  - The shopping list writes 1000 g or more in kg and 1000 ml or more in l (`3.9 kg` of flour rather than `3900 g`), in all recipe formats (HTML, Markdown, text) and in `gram shop`.
  - The weight of the recipe, of each section, and the weight the nutrition is based on follow the same rule.
  - Steps, section ingredient lists, and the run sheet keep grams, as a kitchen scale shows them; `gram cook` now shows the masses you weigh in grams too.
  - Only metric units (`mg`, `g`, `ml`, `cl`, `dl`) convert up to `kg` or `l` (rounded to two decimals), while explicit units in steps (`2 kg`, `1500 ml`) keep their unit. Integrators can use `toLargerMetricUnit` and `isMetricMassUnit` in `@gram-lang/i18n`.
