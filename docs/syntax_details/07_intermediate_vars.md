# Variables & Intermediate Preparations (&)

This is what makes GRAM a culinary programming language. You can name the result of a step to reuse it later.

## 1. Declaration (Output)

To say "The result of this step is called X", we use the arrow `->`.

### Syntax
`->&name`

This is placed **ALWAYS at the end** of a block.

### Two Scope Types

#### A. Local Scope (End of paragraph)
Applies **strictly** to ingredients mentioned in the current step block. It does **not** automatically include ingredients from previous steps in the same section.

```gram
Mix @flour and @water. ->&dough
```
Here, `&dough` is a virtual variable containing the sum of the masses of flour and water **only**.

> [!WARNING]
> If you have a sequence of steps (Mix A, then Mix B, then Cook), adding `->&result` at the *last* step will only capture the ingredients of the last step. To capture the entire section, use **Global Scope** (Section Title).

#### B. Global Scope (End of Section Title)
Applies conceptually to the entire section.

```gram
## Pastry Cream ->&cream
```
Here, the entire result of the "Pastry Cream" section will be accessible elsewhere as `&cream`.

---

## 2. Usage (Input)

To use an intermediate preparation, simply call it by its name (without `@`).

### Syntax
`Use the &name`

*   **No `@`**: This is not a new ingredient to buy, it's a work in process.
*   **Optional Quantity**:
    *   `&dough`: "Take the dough" (Instruction).
    *   `&dough{200g}`: "Take 200g of the dough" (Precision).

> [!IMPORTANT]
> **Shopping List Exclusion**: Intermediate references (`&name`) **NEVER** appear in the shopping list. They represent internal workflow steps, not items to purchase.

## 4. Logic Rules

### Mass Calculation & Double Counting
To prevent double-counting mass when a section produces an intermediate that is then used within the *same* section:

1.  **Local Intermediates (Declared in the current section)**:
    *   They do **NOT** contribute to the section's total input mass.
    *   *Reason*: Their mass comes from the raw ingredients (Flour, Water) that were already counted when they were introduced in previous steps of the section.
2.  **External Intermediates (From other sections)**:
    *   They **DO** contribute to the section's mass.
    *   *Reason*: They are "inputs" for this specific section.

### Dependency & Complexity
1.  **Dependency**: If you declare `->&A`, you MUST use it somewhere in a future step.
2.  **Complexity**: A variable "carries" with it the sum of the masses of its components.
    *   If `&A` = 100g Flour + 50g Water.
    *   Then Mass(&A) = 150g.

## Best Practices (Chaining)

Create a logical chain so the system understands the recipe evolution.

```gram
[Mix] Dry -> &dry mix{}

[Mix] Wet -> &wet mix{}

[Combine] &dry mix{} + &wet mix{} -> &final dough{}
```

This ensures accurate dependency graph generation.
