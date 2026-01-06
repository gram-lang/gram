# Compiler Features

This directory documents the "Smart" logic of the GRAM compiler. 
These features go beyond simple parsing to provide advanced culinary intelligence.

## Contents

*   **[Mass Unification](./01_mass_unification.md)**
    *   How the compiler normalizes all units (cups, tbsp, pieces) into grams to allow mass calculation.
    *   Includes logic for density database and user overrides.

*   **[Yield Management](./02_yield_management.md)**
    *   Distinguishing between Net Mass (what goes in the pot) and Purchasing Mass (what you buy).
    *   Waste factor calculations.

*   **[Nutritional Estimation](./03_nutritional_estimation.md)**
    *   Automatic calculation of calories and macronutrients (Protein, Carbs, Fat, Sugar, Fiber, Salt).
    *   Coverage analysis and data source transparency.

*   **[Time Metrics & Scheduling](./04_time_and_scheduling.md)**
    *   **Active Time** vs **Total Time**.
    *   Asynchronous Background Tasks (e.g., rising, marinating).
    *   Retro-planning logic.
    *   Automated Preparation Time (Mise en place) estimation.

*   **[Shopping List Generation](./05_shopping_list_logic.md)**
    *   The complex logic behind merging ingredients.
    *   Handling Alternatives.
    *   Resolving Composite Ingredients (Driver/Passenger MAX rule).
    *   Ghost Reference detection.
