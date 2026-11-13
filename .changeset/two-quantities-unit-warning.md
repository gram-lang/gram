---
"@gram-lang/kitchen": patch
---

**Kitchen**: An ingredient written as two quantities, such as `@flour{1 cup 5 tbsp}`, now raises an `INVALID_UNIT` warning instead of passing silently as one unknown unit, which left it without a mass and scaled it wrong (`2 cup 5 tbsp`); a number that only describes the unit, as in `{1 tin of 400 g}`, raises nothing.
