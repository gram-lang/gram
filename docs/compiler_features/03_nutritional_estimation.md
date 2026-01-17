# Nutritional Estimation

The compiler allows for automatic **Nutritional Analysis** of recipes. It calculates estimated Calories and Macronutrients (Protein, Carbs, Fat, Sugar, Fiber, Salt) based on the ingredients list.

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

## Ingredient Database

> **✅ Data Source Update (2026)**
>
> The internal database contains around 900 ingredients (right now mostly from French database CIQUAL).
> 
> *   **Primary Sources**: We use **ANSES CIQUAL (2025)** and **USDA FoodData Central** for verified nutritional values.
> *   **Augmentation**: LLMs are still used to fill gaps (densities, obscure ingredients), but these are clearly marked with `# [LLM]` in the source files.
> *   **Transparency**: You can inspect the data in the `data/` folder of the repository.

The database covers:
*   Baking staples (flour, sugar, butter, oils)
*   Produce (fruits, vegetables)
*   Meats & Proteins
*   Common pantry items (pasta, rice, sauces)

## Ingredient States

The nutritional value of food changes when cooked. Gram now supports **State-based Nutrition**.

*   If you specify `@mushroom:canned{}`, the system will use the specific macros for canned mushrooms (if available).
*   If you specify a state that isn't in the database (e.g., `@mushroom:plasma-state`), the compiler checks for a canonical resolution (i18n) or defaults to the raw/default state and issues a **Warning**.

## Partial Data Warnings

To ensure accuracy, the system is strict about missing data:
1.  **Missing Macros**: If an ingredient is in the DB but has no macro data, a warning is raised.
2.  **Preview Hiding**: In the Playground, if *any* ingredient has missing nutritional data (or is missing entirely), the **Nutrition Panel will be hidden** to prevent showing misleading "partial" totals.

The database is not exhaustive; it's a very long-term project. We aim to gradually expand it to include more international ingredients, as well as most of the classic ingredients used in recipes. Any help in completing it is welcome.