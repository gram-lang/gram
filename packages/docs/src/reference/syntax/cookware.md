# Cookware

You can define the tools and equipment needed for a recipe using the `#` symbol.

## Basic Declaration

Like ingredients, if the cookware name is a single word and you only need one of it, you can omit the braces `{}`.

```gram
Heat the #pan.
```

If the name contains spaces or you want to specify a quantity, you must use braces `{}`.

```gram
Take a #baking sheet{}.
```

## Quantities vs Dimensions

Unlike ingredients (which can have complex units like grams or cups), cookware has a strict syntax separation between its **count** and its **physical description**.

### 1. Quantity (Integer Count)
The braces `{}` are strictly reserved for the number of items you need. This must be a pure integer.

```gram
#pan              // Defaults to 1 pan
#ramekins{4}      // 4 ramekins
```

### 2. Dimensions and Materials
To specify the size, dimensions, material, or any other description of the cookware, you must use parentheses `()`.

```gram
#pan(20cm)                  // 1 pan, sized 20cm
#baking sheet{2}(non-stick) // 2 baking sheets, non-stick
```

::: warning Common Mistake
It is a common mistake to put dimensions inside the quantity braces. This is invalid syntax and will cause a compiler error because Gram expects a strict integer inside `{}` for cookware.
- ❌ `#pan{20cm}` -> WRONG.
- ✅ `#pan(20cm)` -> CORRECT.
:::

## Scaling Behavior

Unlike ingredients which usually scale linearly by default, Cookware scaling behavior depends on how the quantity is specified:

- **No quantity** (`#pan`): Defaults to **Fixed** (does not scale).
- **With quantity** (`#ramequins{4}`): Defaults to **Scalable**. If you double the recipe, it will ask for 8 ramequins.
- **Explicit Fixed** (`#=pan{2}`): Forced **Fixed**. Even if you double the recipe, it will still only ask for 2 pans.

## Modifiers and Advanced Syntax

Cookware supports many of the same advanced syntax features as ingredients:

### Modifiers
You can use the Optional (`?`), Hidden (`-`), and Fixed (`=`) modifiers on cookware.

```gram
Use a #?wok if you have one, otherwise a #-large pan will do.
```

### Component Alias (Renaming)
You can rename cookware for display purposes using the `:` operator.

```gram
Use the #cast iron skillet:skillet{}.
```

### Alternatives
You can define acceptable alternatives using the pipe `|` operator.

```gram
Cook in a #pan|#wok.
```
