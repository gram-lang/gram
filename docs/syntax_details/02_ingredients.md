# Ingredients (@)

The basic atom of GRAM. Anything edible or consumable is an ingredient.

## Basic Syntax

`@name{quantity}` or simply `@name`.

*   `@`: Trigger.
*   `name`: Name of the ingredient (Spaces allowed).
*   `{quantity}`: (Optional) Defines the quantity used.
*   `{}`: (Required) If no quantity, empty braces mark the end of the name.

> **Why empty braces?**
> To allow compound names without ambiguity: `@sea salt{}` vs `@sea salt`. Without braces, the parser wouldn't know where the name "sea salt" ends.

## Quantities and Units

The quantity is flexible:
*   **Number**: `@egg{1}`
*   **Mass/Volume**: `@flour{100g}`, `@milk{200ml}`
*   **Fraction**: `@sugar{1/2 cup}`
*   **Range**: `@apples{3-4}`

> **Mass Normalization**: GRAM automatically calculates the mass (in grams) for volumes and units if possible. You can override densities in the metadata. See **[Mass Unification (Compiler Features)](../compiler_features/01_mass_unification.md)**.

## Modifiers (Flags)

Modifiers change the behavior of the ingredient. They are placed right after the `@`.

| Flag | Name | Example | Effect |
| :--- | :--- | :--- | :--- |
| `?` | **Optional** | `@?chili{}` | Marked as optional in the UI. |
| `-` | **Hidden** | `@-salt{}` | Does not appear in the shopping list or in the section list. |
| `*` | **Baker's Reference** | `@*flour{}` | Defines this ingredient as the 100% for Baker's Percentage. |
| `&` | **Reference** | `@&butter{}` | Refers to an ingredient already declared/weighed previously. |

### Focus on Reference (`&`)

Using `@&` is crucial for tracking quantities.

*   `@butter{100g}`: "Take 100g of butter from stock." (Adds to shopping list).
*   `@&butter{50g}`: "Take 50g MORE from stock." (Adds to shopping list).
*   `@&butter{}`: "Use the butter already prepared." (Does NOT add to shopping list, pure instruction).

### Why use a Reference (`@&`) instead of just repetition?

Even if `@butter{20g}` and `@&butter{20g}` both add 20g to the shopping list, the **Reference** adds two critical features:

1.  **Safety (Typo Protection)**:
    *   `@buter{20g}` -> Creates a new ingredient "Buter". Becomes a duplicate/error in shopping list.
    *   `@&buter{20g}` -> **Compiler Error**: "Reference to undefined ingredient". You are protected.

2.  **Instruction Clarity (Zero Quantity)**:
    *   `@butter{}` -> "I need some butter." -> Adds a ghost entry to shopping list.
    *   `@&butter{}` -> "Use the butter defined earlier." -> **No effect** on shopping list. 

**Best Practice:** Use simple declaration (`@name`) only for the *first* time an ingredient appears. Use reference (`@&name`) for *all subsequent uses*.

## Aliases (Renaming)

Sometimes the technical name is long, but you want a short display in the step.

Syntax: `[Display Name]` immediately after the name.

```gram
Add the @apple cider vinegar[vinegar]{1tbsp}.
```
*   **Shopping List**: `Apple cider vinegar`
*   **Step Display**: `vinegar`

## Best Practices

1.  **Be precise from the first occurrence.** `@flour T55{}` rather than `@flour{}` if it matters.
2.  **Use references.** If you divide butter into two parts, use `@butter{...}` then `@&butter{...}`.
3.  **Preparation.** For "chopped onion", prefer `@onion{}(chopped)` (in preparation parentheses) rather than `@chopped onion{}`. This keeps the shopping list clean ("Onion").
