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
3. **Strictly Mass-Based**: The output of a relative quantity calculation is **always** forced into grams (`g`), regardless of the target's original unit.

## Mass Calculation Rules

Since relative quantities rely on computing percentages of existing masses, the compiler (`@gram/analyzer`) standardizes the masses before calculating:

- **Explicit Mass (g, kg, oz, etc.)**: Direct calculation. 50% of 500g = 250g.
- **Volume (ml, l, cup, etc.)**: Converted 1:1 to grams based on the ingredient's density in the database (unless a specific `densities` override is provided).
- **Count/Units (e.g., `@egg{2}`)**: Gram looks up the average physical weight of the ingredient in the database (e.g. 1 egg = 50g), calculates the total mass, and then applies the percentage.
- **Unknown Mass (Edge Case)**: If the target has no explicit weight and is missing from the database (e.g. `@unicorn tears{1 flask}`), the analyzer will refuse to guess. It emits an `UNKNOWN_MASS` warning and leaves the quantity unresolved.

## Shopping List Behavior

When a relative quantity is successfully resolved by the `@gram/analyzer`, it acts exactly like a fixed physical mass. 

It is seamlessly aggregated into the main **Shopping List**. You won't see the internal formula logic, you will only see the final calculated mass required for purchasing.

*Example Shopping List Output:*
```text
Sugar (156 g)
```

However, if mass standardization is disabled globally or the target's mass was completely unknown (the edge case mentioned above), the relative quantity cannot be resolved to a fixed physical mass.

In this scenario, Gram will display a **Hybrid Output**, combining any fixed mass it knows with the raw unresolved formula.

*Example (if we add an extra 20g of fixed sugar):*
```text
Sugar (125% of lemon juice + 20 g)
```

## Error Handling

The compiler is designed to catch logic errors in relative quantities and will output specific warnings:

- **Ghost Reference**: If the target ingredient or variable hasn't been declared previously in the section, the compiler warns `RELATIVE_QUANTITY_UNRESOLVED` (or `VARIABLE_NOT_FOUND`) and outputs `(20% of missing ❓)`.
- **Circular Reference**: If an ingredient tries to calculate a percentage of itself (e.g., `@flour{10% @&flour}`), the compiler warns `CIRCULAR_REFERENCE` and outputs `(10% of self) ⚠️`.
- **Unknown Target Mass**: If the target's mass cannot be resolved from the physical database, the analyzer warns `RELATIVE_QUANTITY_UNKNOWN_MASS` and leaves the output unresolved.
