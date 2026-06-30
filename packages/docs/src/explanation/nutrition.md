# Deep Dive: Nutritional Estimation

The `@gram/analyzer` is capable of automatically computing the macronutrient and micronutrient profile of any recipe. 

However, because nutritional data is highly sensitive and impacts dietary choices, Gram takes a **strict, mathematically conservative approach** to estimating nutrition. This page explains that logic.

## The Calculation Flow

1. **Mass Normalization**: Before any nutritional calculation can occur, the Analyzer must first convert every single ingredient in the recipe into a standard mass in grams. (See [Mass Normalization](./mass-and-yield.md)).
2. **Database Lookup**: The Analyzer queries your `ingredients.yaml` database for the `nutrition` block of each ingredient. The database values must always represent the nutrients **per 100g** of the raw ingredient.
3. **Proportional Scaling**: The Analyzer scales the per-100g database values to match the actual mass used in the recipe.
4. **Aggregation**: The scaled values for all ingredients are summed to calculate the Total Recipe Nutrition.
5. **Portion Division**: If the recipe's frontmatter defines `portions: 4`, the Total Recipe Nutrition is divided by 4 to provide Per-Portion data.

## Strict Partial Data Hiding

The most important philosophy of Gram's nutritional engine is: **No data is better than wrong data.**

If you are cooking a meal with 10 ingredients, and only 9 of them have nutritional data in your database, displaying the sum of those 9 ingredients would falsely underestimate the total caloric content of the meal.

To prevent this, Gram enforces a strict hiding policy:
- If **any** ingredient in the recipe is missing from the database.
- If **any** ingredient is missing its `nutrition` block.
- If **any** ingredient's mass cannot be normalized (e.g., an unknown unit).

**The entire total nutrition panel will be hidden in the UI.** 

The Analyzer will still output a `coverage` percentage (e.g., "90% of ingredients have data"), which the IDE extension uses to warn you, but it will refuse to display a partial total.

## Handling Modifiers

Gram's syntax modifiers impact nutritional calculations in specific ways:

- **Optional Ingredients (`?`)**: Ingredients marked as optional (e.g., `@?whipped cream`) are **excluded** from the base nutritional totals. The Analyzer assumes the most conservative dietary baseline.
- **Alternatives (`|`)**: When a recipe provides alternatives (e.g., `@butter{50g} | @oil{40g}`), the Analyzer only calculates the nutrition for the **first (preferred) option**. It does not average them.
- **Composite Ingredients (`<@`)**: The nutrition of a composite ingredient is calculated based on its children if they have specific data (e.g., `lemon juice` has different macros than `lemon zest`). If the children do not have specific data, the Analyzer falls back to the parent's nutritional data, scaled by mass.
