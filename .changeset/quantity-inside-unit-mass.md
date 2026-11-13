---
"@gram-lang/analyzer": patch
---

**Analyzer**: An ingredient whose unit holds a quantity of its own, such as `@tomatoes{1 tin of 400 g}`, is no longer weighed using the database's unit weight, which counted one tin as one tomato and skewed the shopping-list total. Its mass is now reported as unknown until Gram can parse the inner quantity.
