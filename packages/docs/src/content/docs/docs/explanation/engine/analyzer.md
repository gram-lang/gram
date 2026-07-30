---
title: "Semantic Analysis (`@gram-lang/analyzer`)"
---

The `@gram-lang/analyzer` package represents the final analytical step in the compilation pipeline. It takes the logically sound `CompilationResult` produced by `@gram-lang/kitchen` and performs **Physical Enrichment** by cross-referencing the recipe against an external `ingredients.yaml` database.

This is where the physical world meets the digital code. The analyzer executes a modular 4-pass pipeline (`standardizeSectionMasses`, `enrichShoppingList`, `applyBakersMath`, `estimateNutrition`) computing five major feature sets — each of which can be individually enabled or disabled via options.

## Pass 1: Section Mass Standardization & Yield Calculation

Gram is designed to unify and normalize masses across recipes, calculating the true Total Mass of a dish even if ingredients are written in volumes (cups) or units (eggs).

The **standardizeMass** algorithm follows a strict priority order:

1. **Physical Mass**: If the unit is already a weight (`g`, `kg`, `oz`, `mg`, `lb`), it is simply converted to grams.
2. **Volume → Density**: If the unit is a known volume (e.g., `cup`, `tbsp`, `ml`), the analyzer first checks for an **explicit override** — a `densities` block in the recipe's YAML frontmatter — and uses it if present. Otherwise, it looks up the ingredient's density (`g/ml`) in the `ingredients.yaml` database.
3. **Count → Unit Weight**: If the unit is not a mass or a volume (e.g., `@garlic{3 cloves}`), the analyzer again checks for an override first, then falls back to a specific `unit_weight` in the database to estimate the mass.

:::caution[No silent guessing]
If a volume unit has no density available (no override, no database entry), the analyzer **does not** fall back to assuming water density. It deliberately returns no mass rather than risk a false aggregation (e.g. silently treating "1 cup of flour" as if it weighed the same as water). The item is instead listed by its raw unit, unconverted.
:::

Many raw ingredients have natural waste like peels, cores, or shells. The Analyzer distinguishes between **Net Mass** (what goes into the recipe) and **Purchasing Mass** (Gross Mass — what you actually need to buy), using the `physical.yield` field from the ingredient database.

For example, if an ingredient has a yield factor of `0.65` (35% waste):
- **Recipe**: `@banana{100g}` (This refers to 100g of edible flesh).
- **Analyzer Calculation**: `100g / 0.65 ≈ 154g`.
- **Shopping List Output**: The system will instruct you to buy **~154g** of the unpeeled ingredient to ensure you have 100g of usable flesh.

The direction of this calculation depends on how the quantity was written. An explicit mass/volume (like the banana above) is assumed to be the **Net** mass, with the **Gross** (purchasing) mass derived backward (`Net ÷ yield`). A **count** (e.g. `@avocado{1}`) works the other way around: the ingredient's `unit_weight` already represents the whole purchased unit (**Gross**), so the Net mass actually used by the recipe and by nutrition calculations is derived forward (`Gross × yield`). See [Mass Standardization & Yield](../mass-and-yield.md) for the full breakdown.

This adjustment is computed per ingredient usage — including inline mentions throughout the recipe text — and `@gram-lang/renderer` surfaces the Gross Mass figure in shopping lists across HTML, Markdown, and Print formats.

## Pass 2: Shopping List Enrichment & Alias Resolution

Beyond enriching individual ingredient masses, the Analyzer also re-groups the shopping list itself. `@gram-lang/kitchen` groups purely by the raw id it assigned during parsing, with no knowledge of `ingredients.yaml` — so it can't tell that `@butter` and `@beurre` are the same ingredient, nor merge `100g` of an ingredient with `1 cup` of the same ingredient into one total.

Using the ingredient database, the Analyzer:
- Resolves each ingredient to its **canonical id** (`resolveCanonicalId`), merging aliased entries together.
- Merges cross-unit quantities into a single gram total whenever every contributing entry resolves to a mass (density/unit_weight known).
- Falls back to keeping entries separate — renamed to the canonical id and flagged `multiUnit: true` — when a mass can't be resolved for at least one of them (e.g. no density available), rather than guessing.

Only the `id` is rewritten to the canonical form for grouping purposes. The entry's `name` follows a separate rule to ensure translations are preserved when using a global database:

- **Exact matches** use the database's richer name (e.g. `@flour` → "Wheat Flour").
- **Alias matches** keep the recipe's own wording (e.g. `@farine` → "farine").
- **Missing entries** keep the recipe's own wording.

See [Shopping List Aggregation](../shopping-list-aggregation.md) for the full breakdown and fallback behavior.

## Pass 2.5: Baker's Percentages

If the recipe (or the caller, via a `bakersReference` option) designates a reference ingredient — typically flour, marked with the `*` modifier — the analyzer computes every other ingredient's mass as a percentage of that reference, both for shopping-list items and inline recipe ingredients.

## Pass 3: Nutritional Estimation

The Analyzer can automatically calculate estimated Calories and Macronutrients (Protein, Carbs, Fat, Sugar, Fiber, Sodium) based on the ingredients list. The ingredient database schema also supports finer-grained fields (`sat_fat`, `mono_fat`, `poly_fat`, `alcohol`), but these are not currently aggregated into recipe totals.

1. First, every ingredient is passed through the Mass Standardization algorithm.
2. The analyzer looks up the nutritional data (per 100g) for each ingredient in the database.
3. It aggregates the contribution of each ingredient into a total sum.
4. If a `portions` value is passed in via the analyzer's options, it divides the totals to provide **Per Portion** values.

:::tip[Transparent partial data, not hidden]
Unlike a strict all-or-nothing model, the analyzer always returns whatever nutrition totals it could compute, along with a `coverage` ratio and warnings for any ingredient that was missing nutrition data or couldn't be mass-standardized. Consumers of the data (like the CLI viewer or `@gram-lang/renderer`'s HTML output) use this to show an explicit "incomplete data" indicator alongside the partial totals, rather than hiding the panel outright.
:::

## Open Architecture

The `@gram-lang/analyzer` is designed for open ecosystems. It **does not** read files directly from the filesystem. Instead, the host application (like the CLI or the Playground) loads the database and passes it as a parameter to the `analyze(compilationResult, database, options?)` function, where `options` lets the caller toggle each feature set on or off and configure things like the baker's-percentage reference or the portion count.

This means you can easily plug in a custom database from a REST API, a local JSON file, or any other source, as long as it conforms to Gram's data schema.
