# GRAM Features & Calculations

This directory documents the advanced logic of the GRAM ecosystem. Features are divided between core recipe compilation (`@gram/kitchen`) and physical/macro analysis (`@gram/analyzer`).

## Contents

### 🧑‍🍳 Core Compiler Features (`@gram/kitchen`)

*   **[Shopping List Generation](./05_shopping_list_logic.md)**
    *   The complex logic behind merging ingredients across recipe sections.
    *   Handling of alternative ingredients (`A | B`).
    *   Resolving Composite Ingredients (Driver/Passenger MAX rule).
    *   Ghost Reference detection.

*   **[Time Metrics & Scheduling](./04_time_and_scheduling.md)**
    *   **Active Labor Time** vs **Total Elapsed Time**.
    *   Asynchronous Background Tasks scheduling (e.g., rising, marinating).
    *   Retro-planning syntax and calculation.
    *   Automated Preparation Time (Mise en place) estimation.

---

### 🧪 Physical Analyzer Features (`@gram/analyzer`)

*(Note: The analyzer is an optional layer that requires the host application to provide an Ingredient Database to perform these calculations. See [Ingredient Database](../technical/03_ingredient_database.md) for architecture details.)*

*   **[Mass Normalization](./01_mass_normalization.md)**
    *   How quantities (cups, tbsp, counts) are resolved into grams to enable unified mass calculation.
    *   Density database resolving and custom Frontmatter overrides.

*   **[Yield Management](./02_yield_management.md)**
    *   Distinguishing between Net Mass (what goes in the pot) and Purchasing Mass (Gross Mass - what you actually buy).
    *   Waste factor calculation rules.

*   **[Nutritional Estimation](./03_nutritional_estimation.md)**
    *   Automatic calculation of calories and macronutrients (Protein, Carbs, Fat, Sugar, Fiber, Sodium) per recipe and per portion.
    *   Database resolution coverage and warning triggers.
