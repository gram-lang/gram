# Deep Dive: Mass Standardization & Yield

Gram is deeply rooted in physical reality. Unlike basic markdown parsers that just bold text, the `@gram/analyzer` understands that a "cup of flour" and a "cup of water" have completely different weights.

This page explains the physics engine behind Gram's mass and yield calculations.

## The Three Pillars of Physics

Gram separates the physical properties of ingredients into three distinct concepts within your database. This strict separation ensures the math is always perfect, whether you write in volumes, counts, or weights.

1. **Density (`density`)**: Used strictly to convert **Volumes** to **Mass**.
    * *Example*: `1 cup milk -> 240g` (using a density of 1.03 g/ml).
2. **Unit Weight (`unit_weight`)**: Used strictly to convert **Counts** to **Mass**.
    * *Example*: `1 avocado -> 150g` (the average weight of one whole avocado).
3. **Yield (`yield`)**: The **Waste Factor**. Used strictly to calculate the ratio of edible **Net Mass** to purchasing **Gross Mass** (due to peels, seeds, bones).
    * *Example*: An avocado has a yield of 0.70 (30% is the pit and skin).

---

## The Goal of Mass Standardization

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

## Yield Calculation (The Waste Factor)

In professional kitchens, there is a fundamental difference between what goes *into the pot* and what you *buy at the store*.

- **Net Mass (Edible Portion)**: The weight of the ingredient after peeling, coring, or trimming.
- **Gross Mass (Purchasing Weight)**: The weight of the ingredient as purchased.

The ratio between these two is the **Yield Factor**. 

### How Gram handles Yield

By default, Gram assumes that any ingredient written in your recipe refers to the **Net Mass**. The shopping list generator then works backwards using the `yield` and `unit_weight` to tell you exactly how much to buy.

Let's look at two scenarios for an avocado (`unit_weight: 150g`, `yield: 0.70`):

**Scenario A: Writing in Counts (`@avocado{1}`)**
1. The Analyzer reads "1 unit".
2. It applies the `unit_weight`: `1 * 150g = 150g`. This is the **Gross Mass** (what you bought).
3. It applies the `yield` to find what goes into the recipe: `150g * 0.70 = 105g`. This is the **Net Mass**.

**Scenario B: Writing in Mass (`@avocado{200g}`)**
1. The Analyzer reads "200g". It assumes this is the **Net Mass** you need in the bowl.
2. It applies the `yield` backwards to find the shopping list weight: `200g / 0.70 = 285g`. This is the **Gross Mass**.
3. It can use the `unit_weight` to tell you how many to buy: `285g / 150g = 1.9 avocados` (so, buy 2).

This ensures you never end up short on ingredients after prepping them.
