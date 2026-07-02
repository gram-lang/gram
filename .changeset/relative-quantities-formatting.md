---
"@gram/analyzer": patch
"@gram/kitchen": patch
"@gram/renderer": patch
---

Refined formatting and mass normalization for relative quantities:

- **Cleaner Display**: Relative quantities are now seamlessly displayed without internal `@` or `&` markers (e.g., `125% of lemon juice`). The redundant formula brackets `[125% of...]` have been removed from inline instructions. 
- **Robust Shopping List Aggregation**: The compiler (`@gram/kitchen`) now strictly tracks ingredient lineage using `_usageIds`. This allows the analyzer (`@gram/analyzer`) to flawlessly compute exact masses for complex items in the shopping list without confusing standard ingredients and their alternatives. 
- **Shopping List Accuracy**: When mass normalization is enabled, the shopping list will now accurately display the fully resolved physical mass for relative quantities (e.g., `sugar (156 g)`) instead of falling back to the formula string.
