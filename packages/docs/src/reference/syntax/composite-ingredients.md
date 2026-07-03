# Composite Ingredients

Sometimes, a single `@ingredient` purchased at the store yields multiple different components used in a recipe. For instance, a single lemon provides both **zest** and **juice**. 

If you list `@zest` and `@juice` separately in your recipe, the shopping list won't know they come from the same source. To solve this, Gram introduces **Composite Ingredients**.

## Syntax

You can define a child `@ingredient` that is drawn from a parent `@ingredient` using the `<` operator.

**Format**: `@childName{childQty}<@parentName{parentQty}`

If `parentQty` is omitted (e.g., `<@lemon`), it defaults to **1**. 

::: warning Strict Spacing
Spaces are STRICTLY forbidden around the `<` operator.
- ❌ `@zest{1} < @lemon`
- ✅ `@zest{1}<@lemon`
:::

```gram
Add the @zest{1}<@lemon. 
Then add the @juice{1}<@lemon. 
```

## Calculation Rules

When the Gram Compiler generates the shopping list, it applies specific rules to optimize the required purchasing quantity of the parent `@ingredient`.

### 1. The MAX Rule (Different Parts)
Different parts (children) of the *same* parent share that parent. The compiler determines the maximum parent quantity required across all unique parts.

```gram
@zest{1}<@lemon       // Costs 1 Lemon
@juice{1}<@lemon      // Costs 1 Lemon
```
**Total required**: 1 Lemon (The same lemon provides both).

### 2. The SUM Rule (Same Part)
If you use the *same* part multiple times, the compiler adds up the parent cost.

```gram
@zest{1}<@lemon       // Costs 1 Lemon
... later ...
@zest{1}<@lemon       // Costs 1 Lemon
```
**Total required**: 2 Lemons.

### 3. Direct Usage Aggregation
A composite `@ingredient` mixes perfectly with direct usages of the parent `@ingredient`. The direct usage is simply added to the final calculated maximum.

```gram
@zest{1}<@lemon       // Need 1
@juice{1}<@lemon      // Need 1 (Covered by the one above)
@lemon{2}             // Direct use
```
**Total required**: 3 Lemons.

## Shopping List Output

The resulting shopping list structure handles composite ingredients gracefully, allowing front-end applications to display them hierarchically.

For the example above, the JSON output would look like this:

```json
{
  "type": "composite",
  "id": "lemon",
  "qty": 3,
  "usage": [
    { "id": "zest", "qty": 1, "alias": "zest" },
    { "id": "juice", "qty": 1, "alias": "juice" },
    { "id": "lemon", "qty": 2, "alias": "Direct Use" }
  ]
}
```
