---
"@gram-lang/kitchen": patch
"@gram-lang/analyzer": patch
"@gram-lang/renderer": patch
---

Compiler warnings (`CompilationResult.warnings`, `NutritionMetrics.warnings`) are now
always structured `Warning` objects (`{ code, message, item?, loc?, section? }`) instead
of sometimes being plain strings depending on call order — a latent inconsistency that
could previously produce `"[object Object]"` in some rendered output. `Usage.composite`,
`Usage.options`, and `ProcessedStep.content` are now properly typed instead of `any`.
Also fixes range-based timer quantities (e.g. `~{5-10min}`) never displaying correctly
in `gram diff` output, due to a pre-existing typo checking non-existent fields.
