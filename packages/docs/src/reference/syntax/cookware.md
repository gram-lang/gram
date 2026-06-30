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

## Dimensions and Materials

**Strict Rule:** The braces `{}` are strictly reserved for the **quantity** (an integer count). 
To specify dimensions, materials, or any other descriptions, you must use parentheses `()`.

```gram
#pan{}                        // Qty 1 (implicit)
#baking sheet{}(20x30cm)      // Qty 1, Dimension in parens
#ramekins{4}(porcelain)       // Qty 4, Material in parens
```

::: warning Common Mistake
It is a common mistake to put dimensions inside the quantity braces. This is invalid Gram syntax and will cause errors during compilation.
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
