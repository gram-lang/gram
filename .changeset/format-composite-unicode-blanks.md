---
"@gram-lang/format": patch
---

**Format**: The formatter now glues a composite whose `<` is surrounded by a no-break space or another Unicode blank (`@lemon zest{1} < @lemon{2}`), the same spaced composite that the `SPACED_COMPOSITE` warning flags; it still never joins two lines.
