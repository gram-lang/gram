# Semantic Analysis (`@gram/analyzer`)

The `@gram/analyzer` package represents the final analytical step in the compilation pipeline. It takes the logically sound `CompilationResult` produced by `@gram/kitchen` and performs **Physical Enrichment** by cross-referencing the recipe against an external `ingredients.yaml` database.

This is where the physical world meets the digital code. The analyzer computes four major feature sets: Mass Standardization, Yield Calculation, Nutritional Estimation, and Baker's Percentages — each of which can be individually enabled or disabled via options.

## 1. Mass Standardization

Gram is designed to unify and normalize masses across recipes, calculating the true Total Mass of a dish even if ingredients are written in volumes (cups) or units (eggs).

The **standardizeMass** algorithm follows a strict priority order:

1. **Physical Mass**: If the unit is already a weight (`g`, `kg`, `oz`, `mg`, `lb`), it is simply converted to grams.
2. **Volume → Density**: If the unit is a known volume (e.g., `cup`, `tbsp`, `ml`), the analyzer first checks for an **explicit override** — a `densities` block in the recipe's YAML frontmatter — and uses it if present. Otherwise, it looks up the ingredient's density (`g/ml`) in the `ingredients.yaml` database.
3. **Count → Unit Weight**: If the unit is not a mass or a volume (e.g., `@garlic{3 cloves}`), the analyzer again checks for an override first, then falls back to a specific `unit_weight` in the database to estimate the mass.

::: warning No silent guessing
If a volume unit has no density available (no override, no database entry), the analyzer **does not** fall back to assuming water density. It deliberately returns no mass rather than risk a false aggregation (e.g. silently treating "1 cup of flour" as if it weighed the same as water). The item is instead listed by its raw unit, unconverted.
:::

## 2. Yield Calculation (Waste Factor)

Many raw ingredients have natural waste like peels, cores, or shells. The Analyzer distinguishes between **Net Mass** (what goes into the recipe) and **Purchasing Mass** (Gross Mass — what you actually need to buy), using the `physical.yield` field from the ingredient database.

For example, if an ingredient has a yield factor of `0.65` (35% waste):
- **Recipe**: `@banana{100g}` (This refers to 100g of edible flesh).
- **Analyzer Calculation**: `100g / 0.65 ≈ 154g`.
- **Shopping List Output**: The system will instruct you to buy **~154g** of the unpeeled ingredient to ensure you have 100g of usable flesh.

This adjustment is applied to shopping-list totals, not to every inline ingredient mention throughout the recipe text.

## 3. Nutritional Estimation

The Analyzer can automatically calculate estimated Calories and Macronutrients (Protein, Carbs, Fat, Sugar, Fiber, Sodium) based on the ingredients list. The ingredient database schema also supports finer-grained fields (`sat_fat`, `mono_fat`, `poly_fat`, `alcohol`), but these are not currently aggregated into recipe totals.

1. First, every ingredient is passed through the Mass Standardization algorithm.
2. The analyzer looks up the nutritional data (per 100g) for each ingredient in the database.
3. It aggregates the contribution of each ingredient into a total sum.
4. If a `portions` value is passed in via the analyzer's options, it divides the totals to provide **Per Portion** values.

::: tip Transparent partial data, not hidden
Unlike a strict all-or-nothing model, the analyzer always returns whatever nutrition totals it could compute, along with a `coverage` ratio and warnings for any ingredient that was missing nutrition data or couldn't be mass-standardized. Consumers of the data (like the CLI viewer or `@gram/renderer`'s HTML output) use this to show an explicit "incomplete data" indicator alongside the partial totals, rather than hiding the panel outright.
:::

## 4. Baker's Percentages

If the recipe (or the caller, via a `bakersReference` option) designates a reference ingredient — typically flour, marked with the `*` modifier — the analyzer computes every other ingredient's mass as a percentage of that reference, both for shopping-list items and inline recipe ingredients.

## Open Architecture

The `@gram/analyzer` is designed for open ecosystems. It **does not** read files directly from the filesystem. Instead, the host application (like the CLI or the Playground) loads the database and passes it as a parameter to the `analyze(compilationResult, database, options?)` function, where `options` lets the caller toggle each feature set on or off and configure things like the baker's-percentage reference or the portion count.

This means you can easily plug in a custom database from a REST API, a local JSON file, or any other source, as long as it conforms to Gram's data schema.
