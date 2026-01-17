# Mass Unification & Normalization

GRAM provides a system to unify and normalize masses across recipes. This allows the compiler to calculate the **Total Mass** of a recipe or a section, even when ingredients are expressed in volumes (ml, cups) or units (count).

## How it works

The compiler attempts to convert every ingredient quantity into a **mass in grams (g)**.

This process, called **NormalizeMass**, follows a strict priority order:
    
1.  **Physical Mass**: If the unit is already a weight (`g`, `kg`, `mg`, `oz`, `lb`), it is simply converted to grams. This is considered **Precise**.
2.  **Explicit Override**: If you provided a specific density override in the recipe metadata (see below), it is used to convert volume to mass. This is considered **Explicit**.
3.  **Ingredient Database (Density)**: If the unit is a known Volume (`ml`, `cup`, `tbsp`...), the compiler looks up the ingredient's density. If found, it converts volume to mass. This is considered **Estimated** (`~`).
    *   *Note: Database values (density/weights) are derived from Ciqual/USDA or AI-generated estimates. See [disclaimer](./03_nutritional_estimation.md#ingredient-database).*
4.  **Count / Fallback**: If the unit is **not** a known Mass or Volume (e.g., `unit`, `piece`, or custom units like `clove`, `head`...), it acts as a multiplier. The compiler looks for a **Unit Weight** in the DB or Overrides.
    *   Example: `@garlic{3 cloves}` -> Looks for unit weight of garlic (5g) -> 15g.
    *   This is considered **Estimated** (`~`).
5.  **Default Fallback**: If no specific data is found for volume conversions, `1 ml` is assumed to be `1 g` (Water density). Other unknown units without a unit weight result in failure (`incomplete`).

[![](https://mermaid.ink/img/pako:eNp9VNtu00AQ_ZXRPqXFiWLHaWJLUJGGQh_CnVYQ52FrTxMra6_lXZe2UXjjDcQPwH_wPfwAv8D4EscphEiJd2b3nDl7ZuIV82WAzGVXQn70FzzV8HbsxUCfN5qiqcfO4iTT8CrjsQ71rQvnXGQID-BdHGqPzaDdfgQnC_SXFxjOF3pFCFVsAocydQytuQFL-sq7Tqdz4LF1WaL8bYCJDN6jKjllfI2koHqClvA05ZGaVagqnR99jSoT-mWKremv75-BFn6oECZcqdnBf0o9l1v151LsSKc4i5CkR8IAP0sM0Jcq2SefTje1vyBpaRggMT7jCsYYK_KuThPrBDUPuOZbts3mjgdc-Hl-mvMf1kc2FlS7DQ-e3CS5B19___wGtBahT5f524dmrcqE8Wh1KrM4gDCm9XElajy6L2c8qsRUl2poKQ7XSpRuTT8BPcKIawz-oaIkr-qfciEuub-kiXusFFkPFwRLa-9aZiTgIZhzcqyquYHsVt3Xm2azT-imu5NaZKgvGYXUbyGv0YAkRB93Wr5FN33JOWr_CsJq8CtUuX_fyTw7LbkOm6iGo0V27-22tLWHoaD2__gCZ7Evo0Sgxo3lu8obAGawOc0Cc3WaocEiTCOeh2yVAz2mFxihx1xaBjxdesyL14RJePxBymgDS2U2XzD3igtFUZbQbOM45HP6x9bZFOMA00IDc3tmwcHcFbthrjXsmMPBcDgwHXMwsOwjg90yt21aVqfn9JyB3evapuNY1tpgd0VZs9M96pp927H7Ts9ybLtvMAxCLdNJ-UYrXmzrP7Wxg-Y?type=png)](https://mermaid.live/edit#pako:eNp9VNtu00AQ_ZXRPqXFiWLHaWJLUJGGQh_CnVYQ52FrTxMra6_lXZe2UXjjDcQPwH_wPfwAv8D4EscphEiJd2b3nDl7ZuIV82WAzGVXQn70FzzV8HbsxUCfN5qiqcfO4iTT8CrjsQ71rQvnXGQID-BdHGqPzaDdfgQnC_SXFxjOF3pFCFVsAocydQytuQFL-sq7Tqdz4LF1WaL8bYCJDN6jKjllfI2koHqClvA05ZGaVagqnR99jSoT-mWKremv75-BFn6oECZcqdnBf0o9l1v151LsSKc4i5CkR8IAP0sM0Jcq2SefTje1vyBpaRggMT7jCsYYK_KuThPrBDUPuOZbts3mjgdc-Hl-mvMf1kc2FlS7DQ-e3CS5B19___wGtBahT5f524dmrcqE8Wh1KrM4gDCm9XElajy6L2c8qsRUl2poKQ7XSpRuTT8BPcKIawz-oaIkr-qfciEuub-kiXusFFkPFwRLa-9aZiTgIZhzcqyquYHsVt3Xm2azT-imu5NaZKgvGYXUbyGv0YAkRB93Wr5FN33JOWr_CsJq8CtUuX_fyTw7LbkOm6iGo0V27-22tLWHoaD2__gCZ7Evo0Sgxo3lu8obAGawOc0Cc3WaocEiTCOeh2yVAz2mFxihx1xaBjxdesyL14RJePxBymgDS2U2XzD3igtFUZbQbOM45HP6x9bZFOMA00IDc3tmwcHcFbthrjXsmMPBcDgwHXMwsOwjg90yt21aVqfn9JyB3evapuNY1tpgd0VZs9M96pp927H7Ts9ybLtvMAxCLdNJ-UYrXmzrP7Wxg-Y)

## Alternatives Logic

When using alternatives (e.g., `@butter{100g} | @oil{80g}`), the compiler uses the **first option** (the "preferred" one) to calculate the Section Mass and Total Mass.
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

The compiler calculates:
1.  **Section Mass**: The total mass of ingredients entering a specific section.
2.  **Total Recipe Mass**: The sum of all raw ingredients in the recipe (excluding references to previously prepared sections to avoid double counting).

> **Note**: If some ingredients have no known weight (e.g. `@pinch of salt{}` or unknown unit), the Total Mass might be marked as **Incomplete** (`?`).
