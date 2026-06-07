---
"@gram/compiler": patch
---

Introduce a unified `getNumericQty` utility in `utils.ts` to safely extract numeric values from AST Quantity structures (including fractions, ranges, and nested nodes). This fixes a bug where composite child ingredient quantities using fractions (e.g. `@zest{1/2}`) aggregated to zero in the shopping list.
