---
"@gram-lang/parser": patch
"@gram-lang/kitchen": patch
---

**Parser & Kitchen**: Fractions with a zero denominator (`@flour{1/0 cup}`) now raise `INVALID_QUANTITY` (`reason: "zeroDenominator"`) and drop the invalid number (preserving it in AST `invalidNumber`) instead of silently misreading it.
