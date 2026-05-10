# Yield Management (Waste Factor)

> [!IMPORTANT]
> **Experimental Feature**: Yield Management is an optional feature and **requires Mass Unification** to be enabled. If Mass Unification is disabled, Yield Management will also be inactive.

The compiler includes a **Yield Management** system to distinguish between the **Net Mass** (what goes into the recipe) and the **Purchasing Mass** (Gross Mass - what you need to buy).

## Concept

Many ingredients have waste (peels, cores, shells).
- **Net Mass**: The weight of the edible part used in cooking.
- **Yield (Rendement)**: The percentage of the product that is edible.
- **Gross Mass**: `Net Mass / Yield`.

## How it works

The internal **Ingredient Database** contains yield factors for common produce.
*   **Banana**: Yield ~0.65 (35% waste).
    *   Recipe: `100g banana` (flesh).
    *   Shopping List: `100 / 0.65 = ~154g` (buy 154g of unpeeled bananas).
*   **Egg**: Yield ~0.88.
*   **Onion**: Yield ~0.90.

## Shopping List Display

In the Shopping List (and Playground), if the **Gross Mass** differs significantly (>5%) from the Net Mass, it is displayed explicitly.

*   `Banana: 100g (154g gross)` -> You need 100g of flesh, which means buying 154g of bananas.

## Overrides (Currently Internal)

Currently, yield factors are stored in the internal `ingredient_db.ts`. In the future, this might be exposed via metadata overrides similar to densities.
