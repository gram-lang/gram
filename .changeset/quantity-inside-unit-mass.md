---
"@gram-lang/analyzer": patch
"@gram-lang/i18n": patch
---

**Analyzer**: An ingredient whose unit holds a quantity of its own, such as `@tomatoes{1 tin of 400 g}`, is no longer weighed with the unit weight of the database, which counted the tin as one tomato and gave a wrong mass and a wrong shopping-list total; its mass is now reported as unknown until Gram can read the quantity inside the unit.
