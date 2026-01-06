# Variables & Intermediate Preparations (&)

This is what makes GRAM a culinary programming language. You can name the result of a step to reuse it later.

## 1. Declaration (Output)

To say "The result of this step is called X", we use the arrow `->`.

### Syntax
`->&name{}`

This is placed **ALWAYS at the end** of a block.

### Two Scope Types

#### A. Local Scope (End of paragraph)
Applies to ingredients mixed in the current step.

```gram
Mix @flour{} and @water{}. ->&dough{}
```
Here, `&dough{}` is a virtual variable containing the sum of the masses of flour and water.

#### B. Global Scope (End of Section Title)
Applies conceptually to the entire section.

```gram
## Pastry Cream ->&cream{}
```
Here, the entire result of the "Pastry Cream" section will be accessible elsewhere as `&cream{}`.

---

## 2. Usage (Input)

To use an intermediate preparation, simply call it by its name (without `@`).

### Syntax
`Use the &name{}`

*   **No `@`**: This is not a new ingredient to buy, it's a work in process.
*   **Optional Quantity**:
    *   `&dough{}`: "Take the dough" (Instruction).
    *   `&dough{200g}`: "Take 200g of the dough" (Precision).

**Important Note:** Intermediate references (`&name{}`) **NEVER** appear in the shopping list. They serve only:
1.  Instruction flow.
2.  Relative quantity calculation (e.g., `@salt{1% &dough}`).

## Logic Rules

1.  **Dependency.** If you declare `->&A{}`, you MUST use it somewhere in a future step. Otherwise, the parser will emit an "Unused Intermediate" warning.
2.  **Complexity.** A variable "carries" with it the sum of the masses of its components.
    *   If `&A{}` = 100g Flour + 50g Water.
    *   Then Mass(&A) = 150g.

## Best Practices (Chaining)

Create a logical chain so the system understands the recipe evolution.

```gram
[Mix] Dry -> &dry_mix{}

[Mix] Wet -> &wet_mix{}

[Combine] &dry_mix{} + &wet_mix{} -> &final_dough{}
```

This ensures accurate dependency graph generation.
