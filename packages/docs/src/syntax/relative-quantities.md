# Relative Quantities

Gram allows you to define an ingredient's quantity dynamically as a percentage of another ingredient or an intermediate preparation. This is especially useful in baking (baker's percentages) or when scaling hydration levels.

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

1. **Section Scoping**: The compiler only searches for the target within the **current Section**. You cannot base a relative quantity on an ingredient declared in a different `## Section`.
2. **Accumulation**: It sums **all** previous declarations of the target ingredient within the section up to that point.
3. **Unit Inheritance**: The relative ingredient inherits the unit of its target.

## Mass Calculation Rules

Since relative quantities rely on computing percentages of existing masses, the compiler (`@gram/analyzer`) standardizes the masses before calculating:

- **Mass (g, kg, oz, etc.)**: Normalized cleanly to grams.
- **Volume (ml, l, cup, etc.)**: Converted 1:1 to grams based on a neutral density assumption (unless a specific `densities` override is provided in the frontmatter).
- **Count/Units (e.g., `@egg{2}`)**: Treated as **0 mass** for the percentage calculation. The compiler will still flag the final result as "partial" because it couldn't factor in the eggs.

## Shopping List Behavior

Relative quantities are handled via **Hybrid Aggregation** in the final shopping list. 

Because relative quantities might depend on complex runtime variables (or ingredients with unknown weights like whole eggs), they are **never merged** directly into the "Certain Mass" (the sum of fixed quantities).

Instead, they are displayed as separate **Variable Parts**.

*Example Shopping List Output:*
```text
Sugar : 70g + (50% of @&flour)
```

## Error Handling

The compiler is designed to catch logic errors in relative quantities and will output specific warnings:

- **Ghost Reference**: If the target ingredient or variable hasn't been declared previously in the section, the compiler warns `RELATIVE_QUANTITY_UNRESOLVED` (or `VARIABLE_NOT_FOUND`) and outputs `(20% of @&missing ❓)`.
- **Circular Reference**: If an ingredient tries to calculate a percentage of itself (e.g., `@flour{10% @&flour}`), the compiler warns `CIRCULAR_REFERENCE` and outputs `(10% of @&self) ⚠️`.
