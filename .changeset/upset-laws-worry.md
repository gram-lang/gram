---
"@gram/language-server": minor
"@gram/analyzer": minor
"@gram/renderer": minor
"@gram/kitchen": minor
"@gram/cli": minor
---

Refactor time metrics to align with industry culinary standards (e.g. Schema.org).

- BREAKING CHANGE: The `metrics.totalTime` property in the AST has been renamed to `metrics.cookTime` (representing the critical path cooking duration).
- Added a new `metrics.totalTime` property which accurately represents the mathematical sum of `preparationTime` and `cookTime`.
- All renderers and CLI outputs have been updated to display the 4 time metrics granularly: Prep Time, Active Time, Cook Time, and Total Time.