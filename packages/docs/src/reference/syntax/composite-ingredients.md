# Composite Ingredients

In real-world cooking, recipes often require specific parts of an `@ingredient`—like the **zest** and **juice** of a lemon. 

If you write `@lemon zest` and `@lemon juice` separately, your shopping list will treat them as two completely different products. But lemons are bought whole!

To solve this, Gram introduces **Composite Ingredients**. By telling Gram that the juice and the zest both come from a parent `<@lemon`, the compiler can mathematically optimize your shopping list. If you need the juice of 2 lemons and the zest of 1 lemon, Gram understands they share the same physical source and will smartly add exactly **2 whole lemons** to your shopping list.

## Syntax

You define a composite ingredient using the `<` operator (which can be read as *"comes from"*). You simply append it right after the child `@ingredient`.

**Format**: `@childName{childQty}<@parentName{parentCost}`

- **`childName{childQty}`**: The specific part you are using in this step (e.g., `@lemon juice{100ml}`).
- **`<@parentName`**: The physical item you actually buy at the store (e.g., `<@lemon`).
- **`{parentCost}`**: *(Optional)* How much of the parent is consumed to yield this child part (e.g., `{2}`). If you don't write it, it defaults to `1`.

### Example

Here is how you would declare that 100ml of juice requires 2 lemons, but the zest only requires 1 lemon:

```gram
Add the @lemon juice{100ml}<@lemon{2}. 

Then add the @lemon zest{1}<@lemon. // Implicitly costs 1 lemon
```
**Total required in Shopping List**: 2 Lemons.

::: warning Strict Spacing
Spaces are **strictly forbidden** around the `<` operator.
- ❌ `@lemon zest{1} < @lemon`
- ✅ `@lemon zest{1}<@lemon`
:::

## Calculation Rules

How does the compiler actually calculate the total number of lemons you need to buy? It uses three simple rules to automatically optimize your shopping list.

### 1. The Overlap Rule (Different Parts)
If you use different parts of the same parent (like zest and juice), Gram knows they can come from the exact same physical lemon. It takes the **maximum** required amount across those parts.

```gram
Add @lemon zest{1}<@lemon.  // Needs 1 lemon

Add @lemon juice{1}<@lemon. // Needs 1 lemon
```
> 🛒 **Shopping List**: 1 Lemon (The single lemon provides both parts).

### 2. The Addition Rule (Same Part)
If you use the *same* part multiple times across different steps of your recipe, Gram adds them up. You can't magically get two zests from one lemon!

```gram
Add @lemon zest{1}<@lemon.  // Needs 1 lemon

Add @lemon zest{1}<@lemon.  // Needs another lemon
```
> 🛒 **Shopping List**: 2 Lemons.

### 3. Direct Usage Aggregation
If you also use the whole parent ingredient directly (e.g., cutting a whole lemon into wedges for garnish), Gram simply adds it to the optimized total.

```gram
Add @lemon zest{1}<@lemon.  // Covered by the 1st lemon

Add @lemon juice{1}<@lemon. // Covered by the 1st lemon

Cut @lemon{2} into wedges.  // Needs 2 whole lemons
```
> 🛒 **Shopping List**: 3 Lemons.

## Shopping List Output

The resulting shopping list structure handles composite ingredients gracefully, allowing front-end applications to display them hierarchically.

For the example above, the JSON output would look like this:

```json
{
  "type": "composite",
  "id": "lemon",
  "name": "lemon",
  "qty": 3,
  "usage": [
    { "id": "zest", "unit": null, "qty": 1, "alias": "zest" },
    { "id": "juice", "unit": null, "qty": 1, "alias": "juice" },
    { "id": "lemon", "unit": null, "qty": 2, "alias": "Direct Use" }
  ]
}
```
