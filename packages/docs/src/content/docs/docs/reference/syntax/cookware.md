---
title: "Cookware"
---

You can define the tools and equipment needed for a recipe using the `#` symbol.

## Basic Declaration

Like an `@ingredient`, if the `#cookware` name is a single word and you only need one of it, you can omit the braces `{}`.

```gram
Heat the #pan.
```

If the name contains spaces or you want to specify a quantity, you must use braces `{}`.

```gram
Take a #baking sheet{}.
```

## Quantities vs Dimensions

Unlike an `@ingredient` (which can have complex units like grams or cups), `#cookware` has a strict syntax separation between its **count** and its **physical description**.

### 1. Quantity (Integer Count)
The braces `{}` are strictly reserved for the number of items you need. This must be a pure integer.

```gram
#pan              // Defaults to 1 pan
#ramekins{4}      // 4 ramekins
```

### 2. Dimensions and Materials
To specify the size, dimensions, material, or any other description of the `#cookware`, you must use parentheses `()`.

```gram
#pan(20cm)                  // 1 pan, sized 20cm
#baking sheet{2}(non-stick) // 2 baking sheets, non-stick
```

:::caution
Do not put dimensions inside quantity braces (e.g. ❌ `#pan{20cm}`). Gram expects a strict integer inside `{}`. Use parentheses instead: ✅ `#pan(20cm)`.
:::

## Scaling Behavior

Unlike an `@ingredient` which usually scales linearly by default, `#cookware` scaling behavior depends on how the quantity is specified:

| Format | Example | Behavior | Description |
| :--- | :--- | :--- | :--- |
| **No quantity** | `#pan` | **Fixed** | Does not scale. |
| **With quantity** | `#pan{1}` or `#ramequins{4}` | **Scalable** | Doubling the recipe asks for 2 pans or 8 ramequins. |
| **Explicit Fixed** | `#=pan{2}` | **Fixed** | Even if you double the recipe, it will still only ask for 2 pans. |

## Modifiers and Advanced Syntax

`#cookware` supports many of the same advanced syntax features as an `@ingredient`. For a detailed deep-dive on these concepts, refer to the [Ingredients documentation](./ingredients.md).

### [Modifiers](./ingredients.md#ingredient-modifiers)
You can use the Optional (`?`), Hidden (`-`), Fixed (`=`), and Reference (`&`) modifiers on `#cookware`.

```gram
Use a #?wok if you have one, otherwise a #-large pan will do.

Return to the #&wok to finish the sauce.
```

### [Component Alias (Renaming)](./ingredients.md#component-alias-renaming)
You can rename `#cookware` for display purposes using the `:` operator.

```gram
Use the #cast iron skillet:skillet{}.
```

### [Alternatives](./ingredients.md#alternatives-substitutions)
You can define acceptable alternatives using the pipe `|` operator.

```gram
Cook in a #pan|#wok.
```
