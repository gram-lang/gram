---
title: "Composite Ingredients"
description: "Group related ingredient parts like zest and juice under one parent so Gram computes an accurate shopping list."
---

In real-world cooking, recipes often require specific parts of an `@ingredient`—like the **zest** and **juice** of a lemon. 

If you write `@lemon zest` and `@lemon juice` separately, your shopping list will treat them as two completely different products. But lemons are bought whole!

To solve this, Gram introduces **Composite Ingredients**. By telling Gram that the juice and the zest both come from a parent `<@lemon`, the compiler can mathematically optimize your shopping list. If you need the juice of 2 lemons and the zest of 1 lemon, Gram understands they share the same physical source and will smartly add exactly **2 whole lemons** to your shopping list.

## Syntax

You define a composite ingredient using the `<` operator (which can be read as *"comes from"*). You simply append it right after the child `@ingredient`.

**Format**: `@childName{childQty}<@parentName{parentCost}`

- **`childName{childQty}`**: The specific part you are using in this step. Write its **full name**, parent word included (e.g., `@lemon juice{100ml}`), not a bare generic word — see [Naming the child](#naming-the-child) below for why. Like any other `@ingredient`, `{childQty}` is only required for a multi-word name.
- **`<@parentName`**: The physical item you actually buy at the store (e.g., `<@lemon`).
- **`{parentCost}`**: *(Optional)* How much of the parent is consumed to yield this child part (e.g., `{2}`). If you don't write it, it defaults to `1`.

### Naming the child

While Gram accepts a bare single-word child (`@juice<@lemon{1}`), you should write its full name instead (`@lemon juice{}<@lemon{1}`). That name becomes the ingredient's identity in the shared database (`ingredients.yaml`), used for mass standardization, nutrition, and `gram db enrich`.

Because the database only indexes the child's identifier, generic names collide: `@juice<@lemon` and `@juice<@orange` in another recipe would map to the same entry despite having nothing in common. Using the full name (`lemon juice`, `orange juice`) prevents collisions and automatically links with standalone, non-composite uses of the ingredient (e.g. `@orange juice{1l}` bought in a carton).

Reserve short names for one-off parts you don't track nutritionally. The compiler warns (`COMPOSITE_PARENT_CONFLICT`) if the same short name resolves to different parents within a recipe, and `gram db sync` detects collisions across your whole recipe collection.

### Preparation notes

Both the child and the parent can carry independent `()` preparation notes:
- **Child preparation** goes before the `<`: `@lemon juice{}(strained)<@lemon{1}`.
- **Parent preparation** goes after the cost or parent name: `@lemon juice{}<@lemon{1}(cut in half)`.

Attach the note to the part it actually describes (what is done to the extracted part vs. the whole item). You can also combine both:

```gram
Add the @lemon juice{150ml}(strained)<@lemon{1}(cut in half) to the bowl.
```

### Example

Here is how you would declare that 100ml of juice requires 2 lemons, but the zest only requires 1 lemon:

```gram
Add the @lemon juice{100ml}<@lemon{2}.

Then add the @lemon zest{1}<@lemon. // Implicitly costs 1 lemon
```
**Total required in Shopping List**: 2 Lemons.

:::caution[Strict Spacing]
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
    { "id": "lemon-zest", "qty": 1 },
    { "id": "lemon-juice", "qty": 1 },
    { "id": "lemon", "qty": 2, "alias": "Direct Use" }
  ]
}
```

## Section Ingredient Lists

Unlike the shopping list, a section's own ingredient list is flat, not nested — but it still shows which parent a composite child came from, appended in parentheses right after the child's name:

```md
**Ingredients**:
- **lemon zest** (lemon)
- **lemon juice** (lemon)
```

This parenthetical works the same regardless of how you named the child — it's what keeps a bare short name (`@zest`, `@juice`) traceable to its parent if you do use one. But it's a *display* aid only; it doesn't change the child's underlying database identity, which is why the full name is still the safer default (see [Naming the child](#naming-the-child) above).

If the parent itself also has a `()` preparation (e.g. `@lemon juice{150ml}<@lemon{1}(cut in half)`), it's folded into the same parenthetical, after the parent's name:

```md
**Ingredients**:
- **lemon juice** (lemon, cut in half)
```

The parent's preparation never appears in the shopping list — like any other preparation note, it's instructional context for the recipe, not a shopping-list attribute.
