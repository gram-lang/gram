# Mass Normalization (Physical Analysis)

> [!IMPORTANT]
> **Physical Analysis Feature**: Mass Normalization is processed by the `@gram/analyzer` package. It can be toggled via the analyzer options (or the "Analysis" menu in the Playground). When disabled, the analyzer does not enrich the compiled AST with physical properties (`normalizedMass`, confidence badges, etc.).

GRAM provides a system to unify and normalize masses across recipes. This allows the `@gram/analyzer` to calculate the **Total Mass** of a recipe or a section, even when ingredients are expressed in volumes (ml, cups) or counts (units).

## How it works

The `@gram/analyzer` attempts to convert every ingredient quantity into a **mass in grams (g)**.

This process, called **NormalizeMass**, follows a strict priority order:
    
1.  **Physical Mass**: If the unit is already a weight (`g`, `kg`, `mg`, `oz`, `lb`), it is simply converted to grams. This is considered **Precise**.
2.  **Explicit Override**: If you provided a specific density override in the recipe metadata (see below), it is used to convert volume to mass. This is considered **Explicit**.
3.  **Ingredient Database (Density)**: If the unit is a known Volume (`ml`, `cup`, `tbsp`, `tsp`...), the analyzer looks up the ingredient's density in the provided database. If found, it converts volume to mass. This is considered **Estimated** (`~`).
    *   **I18N Support**: Common volume units and abbreviations are natively supported (including French ones like `càs`, `cas`, `c.à.s` for tablespoon; `càc`, `cac`, `c.à.c` for teaspoon).
    *   *Note: Density values come from your own ingredient database. Use `gram db enrich` to fill in missing entries automatically.*
4.  **Count / Fallback**: If the unit is **not** a known Mass or Volume (e.g., `unit`, `piece`, or custom units like `clove`, `head`...), it acts as a multiplier. The analyzer looks for a **Unit Weight** in the DB or Overrides.
    *   Example: `@garlic{3 cloves}` -> Looks for unit weight of garlic (5g) -> 15g.
    *   This is considered **Estimated** (`~`).
5.  **Default Fallback**: If no specific data is found for volume conversions, `1 ml` is assumed to be `1 g` (Water density). Other unknown units without a unit weight result in failure (`incomplete`).

## Alternatives Logic

When using alternatives (e.g., `@butter{100g} | @oil{80g}`), the analyzer uses the **first option** (the "preferred" one) to calculate the Section Mass and Total Mass.
The other options are ignored for the mass totals, even if they have different weights.

## Metadata Overrides

You can define specific densities or unit weights for your recipe in the Frontmatter (YAML header). This is useful for specific ingredients (e.g., "My special flour is lighter").

Use the `densities` key. Format is `ingredient_name: value`.

*   For **Volumes**: The value is density in `g/ml`.
*   For **Counts**: The value is unit weight in `g/unit`.

```yaml
---
title: My Precision Cake
densities:
  - flour: 0.55       # 1ml of flour = 0.55g
  - egg: 60           # 1 egg = 60g
  - milk: 1.03
---
```

## Visual Indicators

In the Playground (Preview and Shopping List), calculated masses are shown with badges:

*   `120g`: **Precise**. The input was a weight.
*   `~120g`: **Estimated**. Calculated from volume or count using database defaults.
*   `✍️ 120g`: **User Override**. Calculated using your `densities` override.

## Metrics & Totals

The analyzer calculates:
1.  **Section Mass**: The total mass of ingredients entering a specific section.
2.  **Total Recipe Mass**: The sum of all raw ingredients in the recipe (excluding references to previously prepared sections to avoid double counting).

> **Note**: If some ingredients have an unknown unit or mass data cannot be found, the Total Mass might be marked as **Incomplete** (`?`). However, ingredients with explicitly empty braces (e.g., `@salt{}`) are considered to have a **negligible mass (0g)** and will not block the total calculation.
