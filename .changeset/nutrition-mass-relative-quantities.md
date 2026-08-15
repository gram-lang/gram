---
"@gram-lang/analyzer": patch
---

A recipe's total mass now includes ingredients written as a percentage of another ingredient.

An ingredient like `@water{60% @&flour}` was left out of the total weight and made the recipe report its mass as incomplete, even though its calories were counted. Bread and other baker's-percentage recipes were the most affected. Per-section weights had the same problem and are fixed too.
