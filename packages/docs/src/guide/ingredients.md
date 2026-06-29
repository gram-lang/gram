# Ingredients (@)

The basic atom of GRAM. Anything edible or consumable is an ingredient.

## Basic Syntax

`@name{quantity}`, `@name with spaces{}`, or simply `@name`.

*   `@`: Trigger.
*   `name`: Name of the ingredient (Spaces allowed).
*   `{quantity}`: (Optional) Defines the quantity used.
*   `{}`: **Optional** for single-word ingredients without a quantity (`@butter`), but **mandatory** if the ingredient name contains spaces (`@sea salt{}`) so the parser knows where the name ends.

> **Negligible Mass**: Ingredients declared without a quantity (or with empty braces `{}`) are considered to have a **negligible mass (0g)**. This allows mass calculations to be completed (no "Incomplete" status) even if seasonings or dusting flour are not weighed.

## Quantities and Units

The quantity is flexible:
*   **Number**: `@egg{1}`
*   **Mass/Volume**: `@flour{100g}`, `@milk{200ml}`
*   **Fraction**: `@sugar{1/2 cup}`
*   **Range**: `@apples{3-4}`

> **Other languages Units Support**: The compiler natively understands common kitchen unit abbreviations for multiple languages. For now it includes English and French, but it is designed to be expanded in the future.

> **Mass Normalization**: GRAM automatically calculates the mass (in grams) for volumes and units if possible. You can override densities in the metadata. See **[Mass Unification (Compiler Features)](../compiler_features/01_mass_unification.md)**.

## Modifiers (Flags)

Modifiers change the behavior of the ingredient. They are placed right after the `@`.

| Flag | Name | Example | Effect |
| :--- | :--- | :--- | :--- |
| `?` | **Optional** | `@?chili` | Marked as optional in the UI. |
| `-` | **Hidden** | `@-salt` | Does not appear in the shopping list or in the section list. |
| `*` | **Baker's Reference** | `@*flour` | Defines this ingredient as the 100% for Baker's Percentage. |
| `=` | **Fixed** | `@=salt{10g}` | Defines this ingredient quantity as fixed, it won't scale with portions. |
| `&` | **Reference** | `&butter` | Refers to an ingredient already declared/weighed previously. |

> **Warning - INVALID_MODIFIER_COMBINATION**: You can combine modifiers (e.g. `@?-`), but the compiler will throw a warning if it encounters absurd combinations. For example: `?*` (Optional + Baker's Reference), `-*` (Hidden + Baker's Reference), `-&` (Hidden + Reference), or duplicate modifiers (`**`, `--`).

### Focus on Reference (`&`)

Using `@&` is crucial for tracking quantities.

*   `@butter{100g}`: "Take 100g of butter from stock." (Adds to shopping list).
*   `@&butter{50g}`: "Take 50g MORE from stock." (Adds to shopping list and to the current section's ingredients list for mise en place).
*   `&butter`: "Use the butter already prepared." (Does NOT add to shopping list, pure instruction. It is excluded from the section's ingredients list to keep the mise en place clean).

### Why use a Reference (`@&`) instead of just repetition?

Even if `@butter{20g}` and `@&butter{20g}` both add 20g to the shopping list, the **Reference** adds three critical features:

1.  **Safety (Typo Protection)**:
    *   `@buter{20g}` -> Creates a new ingredient "Buter". Becomes a duplicate/error in shopping list.
    *   `@&buter{20g}` -> **Compiler Error**: "Reference to undefined ingredient". You are protected.

2.  **Instruction Clarity (Zero Quantity)**:
    *   `@butter` -> "I need some butter." -> Adds a ghost entry to shopping list.
    *   `@&butter` -> "Use the butter defined earlier." -> **No effect** on shopping list. 

3.  **Clean Section Ingredients (Mise en Place)**:
    *   When listing ingredients at the section level, pure references without quantities (like `@&romarin frais{}`) are excluded from the section's ingredient summary because they represent manipulation of already-measured items.
    *   However, if you write a reference with a quantity (like `@&sucre{50g}`), it represents an additional portion to measure, so it **will** be listed in the section's ingredients list.

**Best Practice:** Use simple declaration (`@name`) only for the *first* time an ingredient appears. Use reference (`@&name`) for *all subsequent uses*.

## Database Validation

GRAM checks your ingredients against **your own** ingredient database (`.gram/ingredients.yaml`). There is no built-in global database — the database is entirely user-defined and contains only the ingredients you actually use.

*   **Missing Ingredient**: If you use `@unicorn meat{}` and it isn't in your database, the analyzer warns: `MISSING_INGREDIENT`. It still appears in the shopping list, but mass/nutrition calculations will be skipped.
*   **Missing Macros**: If an ingredient is in your database but has no nutritional data, you will get a `MISSING_MACROS` warning.

> **Tip**: Run `gram db sync` to automatically add stubs for new ingredients, then `gram db enrich` to fill in the physical and nutritional data with AI.

## Aliases (Renaming)

Sometimes the technical name is long, but you want a short display in the step.

Syntax: `:Display Name` immediately after the name.

```gram
Add the @apple cider vinegar:vinegar{1tbsp}.
```
*   **Shopping List**: `Apple cider vinegar`
*   **Step Display**: `vinegar`

## Best Practices

1.  **Be precise from the first occurrence.** `@bread flour{}` rather than `@flour` if it matters.
2.  **Use references.** If you divide butter into two parts, use `@butter{...}` then `@&butter{...}`.
3.  **Preparation.** For "chopped onion", prefer `@onion(chopped)` (in preparation parentheses) rather than `@chopped onion`. This keeps the shopping list clean ("Onion").
