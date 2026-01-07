# GRAM Language Documentation

## Quick info

*   [**Cheatsheet**](./syntax_details/100_cheatsheet.md) - One-page syntax summary.
*   [**Best Practices**](./syntax_details/98_best_practices.md) - Style guide and recommendations.

## Syntax Reference
The core language specification and usage guides.

*   [**Overview**](./syntax_details/00_overview.md) - A high-level tour of the GRAM language.
*   [**Ingredients**](./syntax_details/02_ingredients.md) - Syntax, quantities, modifiers (`@?`, `@-`, `@*`) and preparations.
*   [**Cookware**](./syntax_details/03_cookware.md) - Fixed vs Scalable tools, dimensions and materials.
*   [**Time & Temperature**](./syntax_details/04_time_and_temp.md) - Timers (`~`), temperatures (`!`) and async tasks.
*   [**Relative Quantities**](./syntax_details/05_relative_quantities.md) - Dynamic calculations (e.g. `60% @flour`).
*   [**Variables & Intermediate**](./syntax_details/06_intermediate_vars.md) - Using `->&dough` to chain recipe parts.
*   [**Structure**](./syntax_details/07_structure.md) - Headers, steps, comments and metadata blocks.
*   [**Advanced Features**](./syntax_details/08_advanced_features.md) - Composites, alternatives, and edge cases.


### Compiler Features
*   [**Mass Unification**](./compiler_features/01_mass_unification.md) - How units are converted to grams.
*   [**Yield Management**](./compiler_features/02_yield_management.md) - Net vs Gross weight (Waste factor).
*   [**Nutritional Estimation**](./compiler_features/03_nutritional_estimation.md) - Calorie and Macro calculation.
*   [**Time Metrics & Scheduling**](./compiler_features/04_time_and_scheduling.md) - Active Time, Total Time, and Retro-planning.
*   [**Shopping List Generation**](./compiler_features/05_shopping_list_logic.md) - Aggregation, alternatives, and ghost references.

### Technical
For contributors and developers implementing GRAM:
*   [**Parsing Architecture**](./technical/01_parsing_architecture.md)
*   [**JSON Output Schema**](./technical/02_json_output.md)

### Helpers

Some vocabulary to help writing recipes. Currently only available in **French**.

*   [**Actions (FR)**](./helpers/vocabulary_actions_FR.md)
*   [**Bakery (FR)**](./helpers/vocabulary_bakery_FR.md)