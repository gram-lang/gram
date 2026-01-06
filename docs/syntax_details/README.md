# GRAM Documentation - Index

Welcome to the full GRAM language documentation.
Every aspect of the syntax is detailed in a dedicated file.

## Contents

### 1. Fundamentals
*   [Overview (Specs)](./00_overview.md) - The original technical specification.
*   [Parser Logic](./01_logic.md) - How the engine thinks (Parsing, AST, Compilation).
*   [Recipe Structure](./07_structure.md) - Sections, Steps, Frontmatter, Comments.

### 2. Detailed Syntax
*   [Ingredients (@)](./02_ingredients.md) - Quantities, Units, Modifiers.
*   [Cookware (#)](./03_cookware.md) - Definition, Scalability (Fixed vs Variable).
*   [Time & Temp (~ and !)](./04_time_and_temp.md) - Strict syntax and ranges.

### 3. Advanced Logic
*   [Relative Quantities](./05_relative_quantities.md) - Understanding `%` calculations.
*   [Variables & Intermediates](./06_intermediate_vars.md) - Chaining preparations (`->&var`).
*   [Composites & Alternatives](./08_advanced_features.md) - Driver/Passenger (`<`) and Choice (`|`).

### 4. Smart/Compiler Features
See the dedicated **[Compiler Features](../compiler_features/01_mass_unification.md)** section for:
*   Mass Unification (Auto-conversion)
*   Yield Management (Waste Factor)
*   Nutritional Estimation

### 5. Technical
*   [JSON Output](./99_json_output.md) - Generated data structure for developers.

### 5. More
*   [Best Practices](./98_best_practices.md) - Recommendations for writing recipes.
*   [Cheatsheet](./100_cheatsheet.md) - Quick reference for common patterns.