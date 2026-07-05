---
"@gram/kitchen": minor
"@gram/analyzer": minor
"@gram/renderer": minor
"@gram/cli": minor
---

Added a centralized `ScaleEngine` in `@gram/kitchen` to make recipe scaling (`--scale`) and Baker's Percentage math safer and more consistent everywhere.

- **@gram/kitchen**: New `resolveScaleFactor()`/`applyScale()` API validates a `--scale` target before computing a factor — rejecting fixed (`@=`) ingredients, relative quantities, sub-recipes, and ingredients split across incompatible units with a clear error instead of a silently wrong number. Scaling is now a pure operation (never mutates the original recipe), and the compiled recipe now carries an explicit `scaleFactor` field.
- **@gram/analyzer**: Fixed the `@*` Baker's-reference auto-detection (it silently never matched before), and it now refuses to use a relative-quantity ingredient as the 100% base instead of computing bogus percentages.
- **@gram/renderer**: Removed a leftover duplicate Baker's-Math implementation that was dead code; along the way, fixed `gram print --bakers-math-only` having no effect.
- **@gram/cli**: `--scale id=value` now supports unit conversion (e.g. `flour=1kg` against a recipe in grams) and suggests the closest matching ingredient name on a typo.