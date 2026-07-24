---
"@gram-lang/parser": patch
"@gram-lang/kitchen": patch
"@gram-lang/renderer": patch
---

`QuantityValueAST` (the parser's internal representation of a parsed number/fraction/range) is now a proper discriminated union instead of a flat interface with every field optional. This is an internal type-safety improvement with no behavior change — it's what would have caught, at compile time, a real bug fixed earlier in `diffRecipes` (checking `qty.from`/`qty.to`, fields that never existed on any variant).
