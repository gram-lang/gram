# GRAM Language Documentation

## Quick info

*   [**Cheatsheet**](./syntax_details/100_cheatsheet.md) - One-page syntax summary.
*   [**Best Practices**](./syntax_details/98_best_practices.md) - Style guide and recommendations.

## Syntax Reference
The core language specification and usage guides.

*   [**Overview**](./syntax_details/00_overview.md) - A high-level tour of the GRAM language.
*   [**Structure**](./syntax_details/01_structure.md) - Headers, steps, comments and metadata blocks.
*   [**Ingredients**](./syntax_details/02_ingredients.md) - Syntax, quantities, modifiers (`@?`, `@-`, `@*`) and preparations.
*   [**Cookware**](./syntax_details/03_cookware.md) - Fixed vs Scalable tools, dimensions and materials.
*   [**Time & Temperature**](./syntax_details/04_time_and_temp.md) - Timers (`~`), temperatures (`!`) and async tasks.
*   [**Advanced Features**](./syntax_details/05_advanced_features.md) - Alternatives (`|`) and Inline Preps.
*   [**Relative Quantities**](./syntax_details/06_relative_quantities.md) - Dynamic calculations (e.g. `60% @flour`).
*   [**Variables & Intermediate**](./syntax_details/07_intermediate_vars.md) - Using `->&dough` to chain recipe parts.
*   [**Composites**](./syntax_details/08_composite_ingredients.md) - Driver/Passenger logic (`<`).


### Advanced Calculations & Capabilities
Detailed explanation of compiler and analyzer features.

*   **[Features Overview](./features/README.md)** - Split between compile-time and analysis-time computations.
*   [**Shopping List Generation**](./features/05_shopping_list_logic.md) - Aggregation, alternatives, and ghost references.
*   [**Time Metrics & Scheduling**](./features/04_time_and_scheduling.md) - Active Time, Total Time, and Retro-planning.
*   [**Mass Normalization**](./features/01_mass_normalization.md) - How units are resolved to grams.
*   [**Yield Management**](./features/02_yield_management.md) - Net vs Gross weight (Waste factor).
*   [**Nutritional Estimation**](./features/03_nutritional_estimation.md) - Calorie and Macro calculation.

### IDE & Tooling
*   [**VS Code Extension**](./features/06_vscode_extension.md) - Features, configuration, and capabilities of the official editor extension.
*   [**Command Line Interface**](./features/07_cli.md) - Using the official CLI to compile, validate, and manage recipes.

### Technical & Architecture
For contributors and developers implementing GRAM:

*   [**Parsing Architecture**](./technical/01_parsing_architecture.md) - The 4-stage pipeline and execution logic.
*   [**JSON Output Schema**](./technical/02_json_output.md) - Structural vs analyzed JSON output.
*   [**Options & Config**](./technical/04_options.md) - Compiler and analyzer configurations.
*   [**Ingredient Database**](./technical/03_ingredient_database.md) - Format and density mapping schema.
*   [**Development Environment**](./technical/05_development_environment.md) - Monorepo architecture, validation, and testing logic.

### Helpers

Some vocabulary to help writing recipes. Currently only available in **French**.

*   [**Actions (FR)**](./helpers/vocabulary_actions_FR.md)
*   [**Bakery (FR)**](./helpers/vocabulary_bakery_FR.md)