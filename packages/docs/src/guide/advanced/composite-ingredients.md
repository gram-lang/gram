# Composite Ingredients & aggregation

Gram is designed to handle complex relationships between ingredients, specifically when a "raw" ingredient (the Parent) is purchased to produce specific parts (the Children) used in the recipe.

## The Problem
In many recipes, what you buy is not exactly what you use.
*   You buy **Eggs** -> You use **Whites** and **Yolks**.
*   You buy **Lemons** -> You use **Zest** and **Juice**.
*   You buy a **Whole Chicken** -> You use **Thighs** and **Breasts**.

If you just listed `@white` and `@yolk`, the shopping list would ask for "White" and "Yolk" separately. We want it to ask for "Eggs".

## Syntax: `Child < Parent`

The syntax `<` establishes a dependency. It can be read as "**drawn from**".

> **Warning:** Spaces are STRICTLY forbidden around the `<` operator. Doing so will trigger a compilation error.

```gram
Add the @zest{1}<@lemon to the bowl.
```

*   **Child**: `@zest` (Used in step)
*   **Parent**: `@lemon` (Added to shopping list)
*   **Parent Quantity**: Implicitly `1` if omitted. `<@lemon` is equivalent to `<@lemon{1}`.

### Examples

**Explicit Quantities on both:**
```gram
@juice{100ml}<@lemon{2}
```
*"I need 100ml of juice. This will require consuming 2 lemons."*

**Implicit Parent Quantity:**
```gram
@zest{1}<@lemon
```
*"I need 1 zest. Requires 1 lemon."*

---

## Calculation Logic

The compiler uses advanced logic to determine the total Shopping List quantity. It does not blindly sum everything up.

### 1. The MAX Rule (Different Children)
When you use *different parts* of the same parent, they are often available "simultaneously" from the same physical item.

*   Step 1: `@zest{1}<@lemon{1}` (Need 1 lemon)
*   Step 2: `@juice{1}<@lemon{1}` (Need 1 lemon)

**Total**: **1 Lemon**.
*Reasoning*: The lemon you bought for the zest is the *same* lemon you squeeze for juice. The compiler calculates the **MAX** requirement across different child types.

### 2. The SUM Rule (Same Child)
When you use the *same part* multiple times, you obviously need more parents.

*   Step 1: `@juice{100ml}<@lemon{2}`
*   Step 2: `@juice{50ml}<@lemon{1}`

**Total**: **3 Lemons**.
*Reasoning*: You consumed the juice of the first 2. You need a fresh lemon for the next batch of juice.

### 3. The Aggregation Rule (Direct + Composite)
Sometimes you use the parent ingredient directly in one step, and as a source for parts in another.

*   Step 1: `@yolk{1}<@egg{1}` (For a sauce)
*   Step 2: `@egg{3}` (For an omelet)

**Total**: **4 Eggs**.
*Reasoning*: The usage is split.
*   **Composite Requirement**: 1 Egg (for the yolk).
*   **Direct Usage**: 3 Eggs.
*   **Result**: 1 + 3 = 4 Eggs.

In the Shopping List, this will appear as a single entry:
*   **Egg (4)**
    *   *Direct Usage (3)*
    *   *yolk (1)*

---

## Complex Example

```gram
Purchase:
@white{2}<@egg{2}
@yolk{1}<@egg{1}
@egg{2}
```

**Calculation:**
1.  **Whites**: Need 2 eggs.
2.  **Yolks**: Need 1 egg.
3.  **Composite Logic**: MAX(Whites, Yolks) = **2 Eggs**.
    *(buying 2 eggs gives us 2 whites and 2 yolks. Enough to cover the need for 1 yolk).*
4.  **Direct Usage**: Need **2 Eggs** explicitly.
5.  **Total**: 2 (Composite) + 2 (Direct) = **4 Eggs**.

**Shopping List Output:**
*   **Egg (4)**
    *   *white (2)*
    *   *yolk (1)*
    *   *Direct Usage (2)*
