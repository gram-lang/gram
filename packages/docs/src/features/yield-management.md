# Yield Management (Waste Factor)

> [!IMPORTANT]
> **Physical Analysis Feature**: Yield Management is an optional physical enrichment feature handled by the `@gram/analyzer` package. It requires **Mass Normalization** to be active.

The `@gram/analyzer` includes a **Yield Management** system to distinguish between the **Net Mass** (what goes into the recipe) and the **Purchasing Mass** (Gross Mass - what you actually need to buy).

## Concept

Many raw ingredients have natural waste (peels, cores, shells).
- **Net Mass**: The weight of the edible part used in cooking.
- **Yield**: The percentage of the raw product that is edible.
- **Gross Mass**: `Net Mass / Yield`.

## How it works

The provided **Ingredient Database** contains yield factors for common produce.
*   **Banana**: Yield ~0.65 (35% waste).
    *   Recipe: `@banana{100g}` (flesh).
    *   Shopping List: `100 / 0.65 = ~154g` (buy 154g of unpeeled bananas).
*   **Egg**: Yield ~0.88.
*   **Onion**: Yield ~0.90.

## Shopping List Display

In the Shopping List (and Playground), if the **Gross Mass** differs significantly (>5%) from the Net Mass, it is displayed explicitly in parenthetical notation.

*   `Banana: 100g (154g gross)` ➡️ You need 100g of edible flesh, which translates to purchasing 154g of raw bananas.

## Overrides

Yield factors are resolved from the external ingredient database passed to the analyzer. Custom databases can easily customize yield values for highly specialized culinary requirements.
