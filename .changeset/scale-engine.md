---
"@gram/kitchen": minor
"@gram/analyzer": minor
"@gram/renderer": minor
"@gram/cli": minor
---

Added a centralized `ScaleEngine` in `@gram/kitchen` to make recipe scaling (`--scale`) and Baker's Percentage math safer and more consistent everywhere.

- **@gram/kitchen**: New `resolveScaleFactor()`/`applyScale()` API validates a `--scale` target before computing a factor — rejecting fixed (`@=`) ingredients, relative quantities, ingredients only used inside a sub-recipe, ingredients inside an alternative-ingredient group, and ingredients split across incompatible units, with a clear error instead of a silently wrong number. A sub-recipe's own total (e.g. "2 lemons") is itself a valid scale target. Scaling is now a pure operation (never mutates the original recipe), and the compiled recipe now carries an explicit `scaleFactor` field. Covered by a new unit test suite.
- **@gram/analyzer**: Fixed the `@*` Baker's-reference auto-detection (it silently never matched before), and it now refuses to use a relative-quantity ingredient as the 100% base instead of computing bogus percentages. `convertUnit()` now accepts an optional density (g/mL) to bridge mass ↔ volume conversions (e.g. `water=150g` against a recipe written in `ml`); new `resolveIngredientDensity()` and `parseDensityOverrides()` helpers resolve that density from a recipe's `densities:` frontmatter override or the ingredient database, deduplicating logic previously only inlined in `standardizeMass()`.
- **@gram/renderer**: Removed a leftover duplicate Baker's-Math implementation that was dead code; along the way, fixed `gram print --bakers-math-only` having no effect.
- **@gram/cli**: `--scale id=value` now supports same-family unit conversion (e.g. `flour=1kg` against a recipe in grams) and, when a density is available, cross-family conversion too (e.g. `water=150g` against a recipe in `ml`); suggests the closest matching ingredient name on a typo; no longer shows corrupted comparison rows for an ingredient split across multiple units in `gram scale`.