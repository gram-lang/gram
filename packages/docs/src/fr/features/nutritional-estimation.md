# Nutritional Estimation

> [!IMPORTANT]
> **Physical Analysis Feature**: Nutritional Estimation is handled by the `@gram/analyzer` package. It can be enabled independently of Mass Standardization (it performs internal mass calculations for data lookup even if Mass Standardization is visually disabled).

The `@gram/analyzer` allows for automatic **Nutritional Analysis** of recipes. It calculates estimated Calories and Macronutrients (Protein, Carbs, Fat, Sugar, Fiber, Sodium) based on the ingredients list.

## How it works

1.  **Mass Standardization**: First, every ingredient is converted to an internal mass in grams (see [Mass Standardization](./mass-standardization.md)).
2.  **Database Lookup**: The analyzer looks up the nutritional data (per 100g) for each ingredient in the provided external database.
3.  **Aggregation**:
    *   It sums up the contribution of each ingredient.
    *   **Alternatives**: Uses the *first option* for calculation.
    *   **Composites**: Aggregates the nutrition of sub-ingredients if available, or the parent if defined.

## Coverage & Estimates

Not all ingredients have known nutritional data in a given database.
*   **Coverage**: The system tracks the percentage of ingredients (by count) that contributed to the totals.
*   **Estimate Badge**: In the Playground, the "Estimate" badge's tooltip shows the coverage percentage (e.g., "Coverage: 90%").

## Portions

If the recipe metadata defines `portions` (e.g., "4 people", "6 servings"), the analyzer extracts the first number found to calculate values **Per Portion**.

```yaml
---
title: Healthy Salad
portions: 2 servings
---
```

If no portion count is found, it defaults to calculating for the whole recipe only.

## Data Points

The system calculates:
*   **Calories** (kcal)
*   **Protein** (g)
*   **Carbs** (g)
    *   of which **Sugars** (g)
*   **Fat** (g)
*   **Fiber** (g)
*   **Sodium** (g)

## Ingredient Database

> **✅ Data Source & Open Architecture**
>
> The `@gram/analyzer` does not read files from the file system; the host application (like the Playground) loads the database and passes it as a parameter to the `analyze` function.
> 
> *   **Primary Sources**: The database is fully user-defined. The analyzer expects an object matching the `IngredientData` schema.
> *   **Customizability**: Developers can supply any custom database (from REST APIs, local JSON, or YAML) as long as it matches the Zod schema.

## Partial Data Warnings

To ensure accuracy and avoid misleading results, the system is strict about missing data:
1.  **Missing Macros**: If an ingredient is in the DB but has no macro data, a warning is raised.
2.  **Unknown Mass**: If the analyzer cannot determine the mass of an ingredient (e.g., unknown ingredient or unit without unit weight), it cannot calculate nutrition for that item.
3.  **Preview Hiding**: In the Playground, if *any* ingredient has missing nutritional data or an unknown mass, the **Nutrition Panel will be completely hidden**. This prevents showing "partial" totals that would underestimate the true nutritional content of the recipe.