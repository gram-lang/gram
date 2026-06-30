# Ingredients

Ingredients are the core building blocks of any Gram recipe.

## Basic Declaration

To declare an ingredient, use the `@` symbol. If the ingredient name contains spaces or requires a specific quantity, you **must** append the quantity inside `{}` braces. If it is a single word without a specific quantity, the braces are optional (the quantity defaults to 1).

```gram
Then add @salt and @ground black pepper{} to taste.
Poke holes in @potato{2}.
```

> **Note:** Ingredient names can contain special characters (like `'`, `&`, `.`), except for the dedicated syntax delimiters (`{`, `}`, `:`, `(`, `)`, `<`, `|`).

### Units
To specify a unit of measurement (weight, volume, etc.), add it directly after the numeric value inside the braces, separated by an optional space.

```gram
Place @bacon strips{1kg} on a baking sheet and glaze with @syrup{1/2 tbsp}.
```

## Scaling & Fixed Quantities

By default, the Gram Compiler scales ingredients **linearly** based on the number of portions requested. 
If you scale a recipe from 2 to 4 servings, an ingredient with `{100g}` becomes `{200g}`.

### Fixed Quantities (`=`)
Some ingredients (like salt, yeast, or spices) should not scale linearly. You can lock their quantity using the `=` modifier.

```gram
Season with @=salt{1 tsp} to taste.
```
This keeps the salt at 1 tsp regardless of how many servings the user calculates.

## Ingredient Modifiers

Gram provides several modifiers to alter how ingredients behave in the parser and the shopping list. Modifiers are placed immediately after the `@` symbol.

| Modifier | Name | Effect |
|---|---|---|
| `=` | **Fixed** | Marks the quantity as fixed (it will not scale with portions). |
| `?` | **Optional** | Marks the ingredient as optional. |
| `-` | **Hidden** | Hides the ingredient from the generated shopping list. |
| `&` | **Reference** | References an ingredient previously declared. Does NOT add it to the shopping list again. |
| `*` | **Baker's %** | Marks the ingredient as the reference (100%) to calculate baker's percentages. |

::: warning Combining Modifiers
You can combine modifiers (e.g., `@?-thyme`). However, absurd combinations (e.g. `?*`, `-*`, `-&`) or duplicates (`**`) will generate a compiler warning (`INVALID_MODIFIER_COMBINATION`).
:::

### The Reference Modifier (`&`)
The reference modifier is crucial for multi-step recipes. 
When you declare `@flour{200g}`, it adds 200g of flour to the shopping list. Later, when instructing the user to use that flour, you must use a reference so it isn't counted twice:

```gram
Add @flour{200g} to the bowl.
Later, dust the work surface with the &flour. // The @ is optional for pure references without quantities
```

You can also use references to *add* to an existing ingredient's total weight in the shopping list:
```gram
@&butter{50g} // Adds 50g to the "butter" entry in the shopping list.
```

## Advanced Syntax

### Short-hand Preparations
Often, an ingredient requires preparation before use. You can define this directly within the declaration using parentheses `()`.

```gram
Mix @butter{1 stick}(room temperature) and @garlic{2 cloves}(peeled and minced).
```

::: warning Spacing is strict
The preparation parenthesis `(...)` MUST be immediately adjacent to the quantity braces `{...}`. Do not add a space between them, otherwise it will be parsed as plain text.
:::

### Component Alias (Renaming)
You can rename an ingredient for display purposes using a colon `:` immediately after the real name. This is useful for keeping the shopping list clean while using a colloquial name in the instructions.

**Format**: `@Real Name:Display Name{Quantity}`

```gram
Deglaze with @dry white wine:wine{100ml}.
```
The shopping list will aggregate this under "dry white wine", but the rendered recipe will just say "wine".

### Alternatives (Substitutions)
You can define acceptable alternatives for an ingredient using the pipe `|` operator.

```gram
Add @milk{100ml}|@water{95ml}.
```
This works with short-hand preparations as well:
```gram
@onion{1}(peeled and chopped)|@shallots{2}(minced)
```

### Ranges
Recipes aren't always exact. You can specify a range using a hyphen `-`.

```gram
Add @eggs{2-4}.
Pour @water{1.5-2l}.
```
