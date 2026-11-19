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

**Parser, Kitchen & Analyzer**: Ingredients and timers can now be written as ratios with units:
  - Write `@eggs{1 / 100 g @&flour}` or `@salt{15 g / 1 L @&water}` for an amount that follows another ingredient across units or piece counts, `&stock{250 ml / 100 g @&rice}` for a homemade preparation (a percentage such as `&stock{250% @&rice}`, ignored until now, works too), and `~{15 min / 500 g @&roast}` or `~{4 min / @&cutlet}` for a cooking time that follows a weight or a count.
  - Ratios within one unit family or between pieces resolve at compile time; across mass and volume, or between weight and pieces, they use the density or unit weight of the ingredient database, and mismatched units are refused with a warning that says why (`RELATIVE_QUANTITY_UNKNOWN_MASS` now carries a `reason`) instead of guessed; a ratio per nothing (`/ 0 g`) raises `INVALID_QUANTITY` with the new `reason: "zeroRatioDenominator"`.
  - A percentage or ratio of a homemade preparation used whole (`Roll out the &dough`) now takes the mass of the section that makes it, marked as an estimate, instead of warning that the mass is unknown; one made by a step (`Mix … ->&dough`) is refused with the new reason `stepProducer`, which asks for the amount used. Inside an imported base, a private intermediate is shown in formulas and warnings by the name its author wrote, never by its internal one (`dough$pate`).
  - Scaling a recipe now resolves these ratios again and recalculates the schedule, the total times and the shopping list.
  - Views show the resolved amount with its ratio in a tooltip, and the language server highlights ratios, completes their targets, renames an intermediate inside them, and adds hovers and inlay hints with what each one came to.
