# Semantic Analysis (`@gram/analyzer`)

The `@gram/analyzer` package represents the final analytical step in the compilation pipeline. It takes the logically sound `KitchenRecipe` and performs **Physical Enrichment** by cross-referencing the recipe against an external `ingredients.yaml` database.

This is where the physical world meets the digital code. The analyzer computes three major feature sets: Mass Standardization, Yield Calculation, and Nutritional Estimation.

## 1. Mass Standardization

Gram is designed to unify and normalize masses across recipes, calculating the true Total Mass of a dish even if ingredients are written in volumes (cups) or units (eggs).

The **NormalizeMass** algorithm follows a strict priority order:

1. **Physical Mass**: If the unit is already a weight (`g`, `kg`, `oz`), it is simply converted to grams (`Precise`).
2. **Explicit Override**: If the recipe's YAML frontmatter contains a `densities` block, the analyzer uses it to override standard conversions (`User Override`).
3. **Database Density**: If the unit is a known volume (e.g., `cup`, `tbsp`, `ml`), the analyzer looks up the ingredient's density (`g/ml`) in the database.
4. **Database Unit Weight**: If the unit is a count (e.g., `@garlic{3 cloves}`), the analyzer looks for a specific `unit_weight` in the database to estimate the mass (`Estimated`).
5. **Fallback**: If no density is found for a volume, the analyzer assumes the density of water (`1ml = 1g`). 

## 2. Yield Calculation (Waste Factor)

Many raw ingredients have natural waste like peels, cores, or shells. The Analyzer distinguishes between **Net Mass** (what goes into the recipe) and **Purchasing Mass** (Gross Mass - what you actually need to buy).

For example, a banana has a yield factor of roughly `0.65` (35% waste).
- **Recipe**: `@banana{100g}` (This refers to 100g of edible flesh).
- **Analyzer Calculation**: `100g / 0.65 = 154g`.
- **Shopping List Output**: The system will instruct you to buy **154g** of unpeeled bananas to ensure you have 100g of usable flesh.

## 3. Nutritional Estimation

The Analyzer can automatically calculate estimated Calories and Macronutrients (Protein, Carbs, Fat, Sugar, Fiber, Sodium) based on the ingredients list.

1. First, every ingredient is passed through the Mass Standardization algorithm.
2. The analyzer looks up the nutritional data (per 100g) for each ingredient in the database.
3. It aggregates the contribution of each ingredient into a total sum.
4. If the recipe defines `portions` in the metadata, it divides the totals to provide **Per Portion** values.

::: warning Strict Partial Data Hiding
To avoid misleading results, the system is strict about missing data. If *any* ingredient in the recipe is missing nutritional data in the database, or if the analyzer cannot determine its mass, it will **completely hide** the total nutrition panel. This prevents the display of "partial" totals that would underestimate the true caloric content.
:::

## Open Architecture

The `@gram/analyzer` is designed for open ecosystems. It **does not** read files directly from the filesystem. Instead, the host application (like the CLI or the Playground) loads the database and passes it as a parameter to the `analyze(kitchenRecipe, database)` function.

This means you can easily plug in a custom database from a REST API, a local JSON file, or any other source, as long as it conforms to Gram's data schema.
