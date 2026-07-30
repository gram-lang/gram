---
title: "Relative Quantities"
---

In cooking, and especially in baking, precision is key. Relying on fixed quantities can sometimes lead to unbalanced recipes when the yield of raw ingredients varies (e.g., a lemon yielding more juice than expected).

Gram solves this by allowing you to define an `@ingredient`'s quantity dynamically as a percentage of another `@ingredient` or an intermediate `&variable`. This ensures that your recipe remains perfectly balanced regardless of real-life variations.

## Syntax

You can target either a base **Ingredient** or an **Intermediate Variable**.

```gram
// Targeting a base ingredient (using @&)

Add @flour{100g} to the bowl.

Then mix in @water{70% @&flour}. // water = 70g

// Targeting an intermediate variable (using &)

Mix the ingredients to form the dough. ->&dough

Add @salt{2% &dough}. // 2% of the total mass of the &dough variable
```

**Formats:**
- `@name{ value% @&TargetIngredient }`
- `@name{ value% &TargetVariable }`

## Resolution Rules

When the Gram Compiler calculates a relative quantity, it follows these strict rules:

| Rule | What it means for you |
| :--- | :--- |
| **Section Scoping** | You **cannot** target an `@ingredient` or a `&variable` declared in a different `## Section`. The compiler only looks at the current section. |
| **Accumulation** | If you declare the same `@ingredient` multiple times in a `## Section`, the percentage will be applied to the **total sum** of those quantities. |
| **Mass-Based** | The calculation is always based on the **weight in grams**. For example, 50% of "2 eggs" (50g each) will output **50g**, not 1 egg. |

## Mass Calculation Rules

Since relative quantities rely on computing percentages of existing masses, the analyzer (`@gram-lang/analyzer`) standardizes the masses before calculating:

| Target Unit Type | Logic before applying percentage | Example |
| :--- | :--- | :--- |
| **Explicit Mass** (g, kg, oz) | None. Direct calculation. | `50%` of `500g` = **250g** |
| **Volume** (ml, l, cup) | Converts to grams using the `@ingredient`'s `physical.density` field in the YAML database. | 500ml water ➡️ 500g.<br/>`50%` = **250g** |
| **Count** (`@egg{2}`) | Looks up the average `physical.unit_weight` field in the YAML database. | 2 eggs (50g ea) ➡️ 100g.<br/>`50%` = **50g** |
| **Unknown** (`1 flask`) | Cannot guess. Emits `UNKNOWN_MASS` warning. | Leaves the quantity unresolved. |

## Shopping List Behavior

Because relative quantities are essentially mathematical formulas (e.g., `125% of lemon juice`), the Gram Compiler must decide how to display them in the final **Shopping List**. It does this based on whether it can successfully resolve the formula into a physical mass.

### 1. Fully Resolved (Standard Behavior)

If the compiler successfully determines the physical mass of the target (using the mass calculation rules above), it evaluates the formula. The result is treated exactly like a fixed physical mass and is seamlessly aggregated into your shopping list. You will not see the internal math, only the final required weight for purchasing.

*Example Shopping List Output:*
```text
- Sugar: 156g
```

### 2. Unresolved & Hybrid Output

Sometimes, the compiler cannot evaluate the formula. This happens if you disabled mass standardization globally, or if the target's mass is completely unknown (e.g., the target uses an unstandardized unit like `1 flask`, or it requires a volume-to-mass conversion but the `@ingredient` is missing from your `ingredients.yaml` database).

In this case, Gram cannot give you a final weight in grams. Instead, it falls back to a **Hybrid Output**. It will display the raw formula text, and gracefully add any other fixed quantities of that `@ingredient` it found in the recipe.

*Example Shopping List (assuming the recipe also uses a fixed `@sugar{20g}` elsewhere):*
```text
- Sugar: 20g + (125% of lemon juice)
```
This ensures you never lose purchasing requirements, even if the math cannot be perfectly resolved!

## Error Handling

The compiler is designed to catch logic errors in relative quantities and will output specific warnings:

- **Ghost Reference**: If the target `@ingredient` or `&variable` hasn't been declared previously in the section, the compiler warns `RELATIVE_QUANTITY_UNRESOLVED` (or `VARIABLE_NOT_FOUND`) and outputs `(20% of missing ❓)`.
- **Circular Reference**: If an `@ingredient` tries to calculate a percentage of itself (e.g., `@flour{10% @&flour}`), the compiler warns `CIRCULAR_REFERENCE` and outputs `(10% of self) ⚠️`.
- **Unknown Target Mass**: If the target's mass cannot be resolved from the physical database, the analyzer warns `RELATIVE_QUANTITY_UNKNOWN_MASS` and leaves the output unresolved.

Because a relative quantity's value is always derived from another ingredient, it also can't be used as a [`--scale` reference target](/docs/how-to/scale-recipes#limits-of-reference-scaling) or as the Baker's Percentage base — see [Deep Dive: Scaling](/docs/explanation/scaling) for the full set of rules and error codes shared across both.
