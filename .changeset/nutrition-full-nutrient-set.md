---
"@gram-lang/analyzer": patch
"@gram-lang/cli": patch
"@gram-lang/language-server": patch
---

Saturated, mono- and polyunsaturated fats and alcohol now count towards a recipe's nutrition totals.

You could already record them in `ingredients.yaml`, `gram db lint` checked them, and `gram db search` and the editor hover displayed them — but they were silently dropped when totalling up a recipe. Related fixes:

- `gram db enrich` can now propose mono- and polyunsaturated fats. It previously had no way to, even though the database accepted them.
- The editor hover no longer multiplies sodium by a thousand. Database values are in milligrams, as everywhere else in Gram; the tooltip was reading them as grams.
