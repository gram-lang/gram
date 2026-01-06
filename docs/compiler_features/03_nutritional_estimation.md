# Nutritional Estimation

The GRAM Compiler allows for automatic **Nutritional Analysis** of recipes. It calculates estimated Calories and Macronutrients (Protein, Carbs, Fat, Sugar, Fiber, Salt) based on the ingredients list.

## How it works

1.  **Mass Normalization**: First, every ingredient is converted to a mass in grams (see [Mass Unification](./01_mass_unification.md)).
2.  **Database Lookup**: The compiler looks up the nutritional data (per 100g) for each ingredient in its internal database.
3.  **Aggregation**:
    *   It sums up the contribution of each ingredient.
    *   **Alternatives**: Uses the *first option* for calculation.
    *   **Composites**: Aggregates the nutrition of sub-ingredients if available, or the parent if defined.

## Coverage & Estimates

Not all ingredients have known nutritional data.
*   **Coverage**: The system tracks the percentage of ingredients (by count) that contributed to the totals.
*   **Estimate Badge**: In the Playground, the "Estimate" badge's tooltip shows the coverage percentage (e.g., "Coverage: 90%").

## Portions

If the recipe metadata defines `portions` (e.g., "4 people", "6 servings"), the system attempts to extract the first number found to calculate values **Per Portion**.

```gram
---
title: Healthy Salad
portions: 2 servings
---
```

If no number is found, it defaults to calculating for the whole recipe only.

## Data Points

The system calculates:
*   **Calories** (kcal)
*   **Protein** (g)
*   **Carbs** (g)
    *   of which **Sugars** (g)
*   **Fat** (g)
*   **Fiber** (g)
*   **Salt** (g)

## Ingredient Database

The internal database covers ~60 common ingredients including:
*   Baking staples (flour, sugar, butter, oils)
*   Produce (fruits, vegetables)
*   Meats & Proteins
*   Common pantry items (pasta, rice, sauces)

*Note: This is an estimation tool. Values are averages and may differ from specific brands.*
