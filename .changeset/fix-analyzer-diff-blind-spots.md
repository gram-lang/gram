---
"@gram-lang/analyzer": patch
---

`gram diff` (and `diffRecipes`) now detects quantity changes inside composite ingredients (`<@parent`) and alternative groups (`@a|@b`), which it previously ignored entirely — a recipe that doubled a composite or alternative's quantities used to be reported as having no changes at all. It also no longer loses one of two same-titled sections, or two same-named timers/temperatures within a single section, when comparing two recipes.
