---
"@gram-lang/renderer": patch
"@gram-lang/cli": patch
"@gram-lang/i18n": patch
---

**Rendering & CLI**: Numbers are now written as a cook reads them, in the language of the recipe:
  - Every view follows the `lang` option, with a decimal comma in French (`1,5 kg`, `147,5 g`): quantities, ranges, timers, temperatures, standardized masses and nutrition values.
  - `gram shop` and `gram scale` follow the project's `language` setting instead of the language of the computer, and no longer add a thousands separator (`2250 ml`, as a recipe writes it).
  - Spoons, cups and imperial measures are written in fractions, as a cook writes them: `1.75 cup` and `1 3/4 cup` both show `1 3/4 cup`, in the steps, the shopping list, `gram shop`, `gram scale` and `gram cook`. Metric units and counts keep decimals.
  - Numbers read back by a script or a file (data attributes, JSON) are unchanged.
  - Integrators can use the same rule through `formatNumber`, `localizeDecimals` and `toKitchenFraction` in `@gram-lang/i18n`.
