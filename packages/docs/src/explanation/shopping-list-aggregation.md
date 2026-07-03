# Deep Dive: Shopping List Aggregation

When the `@gram/kitchen` package processes an Abstract Syntax Tree (AST), one of its core responsibilities is generating the shopping list. 

This is not a simple concatenation of ingredients. The compiler performs a complex aggregation process to ensure the list is physically accurate and optimized for purchasing.

## The Aggregation Pipeline

When a recipe (or a batch of multiple recipes) is passed to the Kitchen for shopping list generation, the following pipeline executes:

### 1. ID Normalization and Aliasing
The compiler first groups ingredients by their ID. If it encounters `@butter` and `@beurre` (assuming `beurre` is listed as an alias of `butter` in `ingredients.yaml`), it merges them into a single bucket under the primary key `butter`.

### 2. Unit Merging
If the grouped ingredients share the same unit (e.g., `100g` and `50g`), they are simply summed (`150g`).

If they have different units (e.g., `100g` and `1 cup`), the compiler cannot sum them algebraically. Instead, it defers to the Analyzer's Mass Standardization engine to convert the `1 cup` into grams using the ingredient's specific density, and then sums the resulting masses.

### 3. Ghosting Relative Quantities
Relative quantities (like `@water{50% @&flour}`) pose a unique problem for shopping lists, especially in multi-recipe batch processing. 

If you scale the batch, the water quantity depends on a flour quantity that might belong to a specific recipe. To prevent mathematical paradoxes, the Kitchen **ghosts** relative quantities in the shopping list. This means they are excluded from the main aggregation and listed separately as unresolvable dependencies, ensuring the static weights remain mathematically pure.

### 4. Resolving Composites (MAX vs SUM)
The most complex part of the aggregation pipeline is handling Composite Ingredients (`<@`). 

When multiple children point to the same parent, the compiler uses two distinct rules to figure out how many parents you need to buy:

1. **The MAX Rule (Non-Destructive)**: 
   If the children use *different parts* of the parent (e.g., lemon juice and lemon zest), you don't need two lemons. The compiler takes the maximum equivalent parent mass required by either child. If you need 3 lemons worth of juice, but only 1 lemon worth of zest, the shopping list will say `3 lemons`.
2. **The SUM Rule (Destructive)**:
   If the children use the *same part* of the parent (e.g., chicken breast for a salad, and chicken breast for a soup), you cannot reuse the same chicken. The compiler sums the equivalent parent masses required by both children.

## The Final Output
The result is a highly optimized, deduplicated, and mathematically sound array of `ShoppingItem` objects, grouped by their culinary categories, ready to be rendered in the terminal or a web UI.
