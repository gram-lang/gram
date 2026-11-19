---
"@gram-lang/i18n": minor
"@gram-lang/parser": minor
"@gram-lang/modules": minor
"@gram-lang/kitchen": minor
"@gram-lang/analyzer": minor
"@gram-lang/renderer": minor
"@gram-lang/language-server": minor
"@gram-lang/cli": minor
"gram-lang": minor
---

**Parser, Kitchen & Analyzer**: Ingredients, intermediates, and timers can now be written as unit ratios:
  - Supports ratios across units or counts on ingredients (`@eggs{1 / 100 g @&flour}`, `@salt{15 g / 1 L @&water}`), homemade preparations (`&stock{250 ml / 100 g @&rice}`, plus percentages like `&stock{250% @&rice}`), and proportional timers (`~{15 min / 500 g @&roast}`, `~{4 min / @&cutlet}`).
  - Resolves compatible units at compile time and cross-family ratios via the ingredient database; incompatible or zero-denominator ratios raise `RELATIVE_QUANTITY_UNKNOWN_MASS` (with `reason`) or `INVALID_QUANTITY` (`reason: "zeroRatioDenominator"`) instead of guessing.
  - Whole-use references to a section preparation (`Roll out the &dough`) now estimate mass from the producing section, while step-produced intermediates (`Mix … ->&dough`) require an explicit amount (`reason: "stepProducer"`); warnings and formulas in imported bases display original author names rather than internal aliases.
  - Scaling a recipe re-resolves all ratios and recomputes the schedule, total times, and shopping list.
  - Views display resolved ratios in tooltips, and the language server provides syntax highlighting, target completion, intermediate renaming, hover previews, and inlay hints.
