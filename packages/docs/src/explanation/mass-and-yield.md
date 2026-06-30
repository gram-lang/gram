# Deep Dive: Mass Normalization & Yield

Gram is deeply rooted in physical reality. Unlike basic markdown parsers that just bold text, the `@gram/analyzer` understands that a "cup of flour" and a "cup of water" have completely different weights.

This page explains the physics engine behind Gram's mass and yield calculations.

## The Goal of Mass Normalization

The primary goal of the Analyzer is to calculate the **Total Mass** of a recipe. This is essential for nutritional estimation, cost calculation, and baking ratios.

To do this, the Analyzer must convert every ingredient quantity into a unified baseline: **grams (g)**.

### The Conversion Algorithm

When the Analyzer encounters an ingredient, it runs it through a strict priority algorithm to find its mass:

1. **Precise Mass**: If you wrote `@flour{200g}` or `@beef{1kg}`, the Analyzer does no work. It simply converts it to grams.
2. **User Override**: If you provided a specific density override in the recipe's YAML frontmatter (e.g., `densities: { flour: 0.55 }`), it uses this explicit value to convert the volume you requested into mass.
3. **Database Density**: If you requested a known volume (`ml`, `cup`, `tbsp`, `tsp`) and your `ingredients.yaml` has a `density` field for that ingredient, it calculates `Volume * Density = Mass`.
4. **Database Unit Weight**: If you requested a count (`@egg{3}` or `@garlic{2 cloves}`) and your database has a `unit_weight` field, it calculates `Count * Unit Weight = Mass`.
5. **Water Fallback**: If no specific data is found for a volume conversion, the Analyzer assumes the density of water (`1 ml = 1 g`).
6. **Incomplete**: If the unit is an unknown count (e.g., `1 piece of mysterious fruit`) and has no unit weight in the database, the mass calculation fails and is marked as "incomplete".

## Yield Management (The Waste Factor)

In professional kitchens, there is a fundamental difference between what goes *into the pot* and what you *buy at the store*.

- **Net Mass (Edible Portion)**: The weight of the ingredient after peeling, coring, or trimming.
- **Gross Mass (Purchasing Weight)**: The weight of the ingredient as purchased.

The ratio between these two is the **Yield Factor**. 

### How Gram handles Yield

If your database defines a `yield` factor for an ingredient (e.g., Banana = 0.65, meaning 35% is the peel), Gram assumes that any ingredient written in your recipe refers to the **Net Mass**.

If you write `@banana{100g}`, Gram assumes you need 100g of edible banana flesh. 

When generating the shopping list, the Analyzer will calculate the required purchasing weight: `100g / 0.65 = 154g`. The final shopping list will instruct you to buy **154g** of unpeeled bananas.

This ensures you never end up short on ingredients after prepping them.
