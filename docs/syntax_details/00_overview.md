## The .gram recipe specification

Below is the specification for defining a recipe in Gram.

### 1. Metadata (Frontmatter)
A **YAML** block at the start of the file.
The parser accepts **any** key-value pair. You can add custom fields for your own needs.

However, some keys have specific effects in the GRAM Compiler:

**Functional Keys (Compiler Behavior):**
*   `densities`: Overrides for mass conversion (See [Mass Unification](../compiler_features/01_mass_unification.md)).
*   `portions`: Number of servings for Nutritional Analysis (See [Nutrition](../compiler_features/03_nutritional_estimation.md)).

**Recommended Informational Keys (Display):**
*   `title`: The recipe name.
*   `originalTitle`: Using original language (e.g., Japanese, Italian).
*   `description`: Short summary (used for SEO meta tags).
*   `tags`: List of categories or keywords.
*   `category`: Main category (e.g. "Dessert", "Main Course").
*   `author`: Name or list of names.
*   `source`: URL(s) to the original recipe.
*   `date`, `lastUpdated`: YYYY-MM-DD.
*   `size`: Serving size description or dimensions (e.g. "20x20cm mold").

```yaml
---
title: 'Matcha Brownies'
originalTitle: '抹茶ブラウニー'
description: 'A simple Japanese-style matcha brownie...'
author: ["Auguste Kerflec"]
tags: ['brownie', 'matcha']
category: 'Dessert'
source: ['https://example.com/matcha-brownie']
size: '20x20cm'

# Functional Fields
portions: 4
densities:
  - flour: 0.55
---
```

### Ingredients

To define an ingredient, use the `@` symbol. You MUST always indicate the end of the name with `{}` or `{quantity}`.

> **Note:** Ingredient names can contain special characters (like `'`, `&`, `.`), except for the dedicated syntax delimiters (`{`, `}`, `[`, `]`, `(`, `)`, `<`, `|`).


```gram
Then add @salt{} and @ground black pepper{} to taste.
```

To indicate the quantity of an item, place the quantity inside `{}` after the name.

```gram
Poke holes in @potato{2}.
```

To use a unit of an item, such as weight or volume, simply add it after the value (separated by an optional space).

```gram
Place @bacon strips{1kg} on a baking sheet and glaze with @syrup{1/2 tbsp}.
```

### Steps

Each paragraph in your recipe file is a cooking step. Separate steps with an empty line.

```gram
A step,
the same step.

A different step.
```

Steps can optionally start with an **Action** enclosed in brackets. This highlights the main method used in that step.

```gram
[Mix] The @flour{} and @water{}.

[Bake] In the #oven for ~{30min}.
```

### Sections

Some recipes are more complex than others and may include components that need to be prepared separately. In such cases, you can use the section syntax, e.g., `## Dough`.

```gram
## Dough

Mix @flour{200g} and @water{100ml} together until smooth.

## Filling

Combine @cheese{100g} and @spinach{50g}, then season to taste.
```

#### Retro-planning

You can indicate a retro-planning timing in the section title using `{T-...}` at the end of the title.

```gram
## Puff Pastry {T-2d}
```

This indicates that this section should be prepared 2 days in advance.
The timing inside `{T-...}` MUST start with a number and MUST end with one of the supported unit suffixes:
- `d`: days (e.g. `2d`)
- `h`: hours (e.g. `12h`)
- `min` or `m`: minutes (e.g. `30min`, `45m`)

Invalid formats will likely trigger a warning.

#### Intermediate declarations

You can declare an intermediate preparation using `->&` at the end of the title. This preparation will be available for use in the recipe.

```gram
## Puff Pastry ->&dough{}
```

More about intermediate preparations in the [Intermediate Preparations](./07_intermediate_vars.md) section.

**Order of operations:**
If using both Retro-planning and Intermediate declarations in a header, the order is strict:
`## Title {Retro-Planning} ->&Intermediate{}`

```gram
## Puff Pastry {T-2d} ->&dough{}
```

### Comments

You can add comments up to the end of the line to gram text with `//`.

```gram
// Don't burn the roux!

Mash @potato{2kg} until smooth // alternatively, boil 'em first, then mash 'em, then stick 'em in a stew.
```

Or block comments with `/* comment text */`.

```gram
Slowly add @milk{4 cup} /* TODO change units to litres */, keep mixing
```

### Cookware

You can define any necessary cookware with `#`. Like ingredients, you must use braces even if it's a single word.

**Rule:** The braces `{}` are strictly reserved for the **quantity** (integer count).
Use parentheses `()` for dimensions, material, or any other description.

```gram
#potato masher{}              // Qty 1 implicit
#baking sheet{}(20x30cm)      // Qty 1, Dimension in parens
#ramekins{4}(porcelaine)      // Qty 4, Material in parens
```

**Common Mistakes (Invalid):**
*   `#pan{20cm}` -> WRONG. Convert to `#pan{}(20cm)`.
*   `#bowl{large}` -> WRONG. Convert to `#bowl{}(large)`.

Cookware scaling behavior depends on quantity specification:
- **No quantity** (`#pan{}`): Defaults to **Fixed**.
- **With quantity** (`#ramequins{4}`): Defaults to **Scalable**.
- **Explicit Fixed** (`#pan{=2}`): Forced **Fixed**.

### Timer

You can define a timer using `~`.
**Rule:** Timers MUST specify a unit. Fuzzy text like `~{about 10 minutes}` is invalid.

Supported units:
- `min` (minutes) - Preferred standard.
- `h` (hours).
- `d` (days).
- `s` (seconds).
- *Note:* `m` or `minutes` will be automatically corrected to `min`.

Timers can be **Synchronous** (blocking) or **Asynchronous** (background).

#### Synchronous (Default)
Stops the workflow. The cook must wait.
```gram
Bake for ~{25min}.
```

#### Asynchronous
Runs in the background. The cook can proceed to the next step immediately. Use the `&` modifier.
```gram
Let the dough rest for ~{1h}&.
Meanwhile, prepare the filling...
```

Timers can have a name too:

```gram
Boil @eggs{2} for ~eggs{3min}.
```

Applications can use this name in notifications.

Timers can have a range too :

```gram
Boil @eggs{2} for ~eggs{3-5min}.
```

### Scaling Behavior

#### Linear Scaling (Default)

Most ingredients scale linearly with servings:

```gram
Add @milk{1/2 cup} and mix until smooth.
```

When scaling from 2 to 4 servings, the milk quantity doubles to 1 cup.

#### Fixed Quantities

Some ingredients shouldn't scale. Use `=` to lock the quantity:

```gram
Season with @salt{=1 tsp} to taste.
```

This keeps salt at 1 tsp regardless of serving size.

## Advanced

### Short-hand preparations

Many recipes involve repetitive ingredient preparations. To simplify this, you can define these common preparations directly within the ingredient reference using shorthand syntax:

```gram
Mix @butter{1 stick}(room temperature) and @garlic{2 cloves}(peeled and minced) into paste.
```

> **Note:** The preparation parenthesis `(...)` MUST be immediately adjacent to the quantity braces `{...}`. Do not add a space between them, otherwise it will be parsed as plain text.

### Relative Quantities (Percentage of Mass)

You can define an ingredient's quantity as a percentage of another ingredient's accumulated quantity within the same section.

```gram
@flour{100g}
...
@water{70% @flour} // water = 70g
```

- **Syntax**: `@...{ value% @Target Name }` or `@...{ value% &Variable Name }`
- **Resolution**:
    - Limits search to the current **Section**.
    - Sums **all** previous quantities of the target ingredient in that section.
    - Inherits unit from the target.
- **Variables**: Target a specific variable with `&`.
    - `@{20% &dough}` calculates 20% of the total mass of the variable `&dough`.
    - The variable's mass is defined by the sum of ingredients (and other variables) used to create it (e.g. `->&dough`).
- **Mass Calculation Rules**:
    - **Mass (g, kg, oz...)**: Normalized to grams.
    - **Volume (ml, l...)**: Converted 1:1 to grams (neutral density assumption).
    - **Count/Units (@egg{1})**: Treated as 0 mass. Ignored for calculation but flagged as partial.
- **Shopping List Behavior (Hybrid Aggregation)**:
    - Relative quantities are **never merged** into the "Certain Mass" (sum of fixed quantities).
    - They are displayed as separate **Variable Parts** in the shopping list.
    - *Example:* "Sugar : 70g + (50% of @flour)".
- **Error Handling**:
    - **Ghost Reference**: If source is not found, displays `(20% of @missing ❓)`.
    - **Circular Reference**: If a cycle is detected, displays `(10% of @self) ⚠️ Circular Reference`.

## Modifiers

With the ingredient modifiers you can alter the behaviour of ingredients. There
are 5 modifiers:

  - `&` **Reference**. References another ingredient with the same name.
    *   **Safety**: Verifies that the ingredient was previously declared.
    *   **Logic**:
        *   `@&butter{50g}`: Adds 50g to the shopping list for 'butter'.
        *   `@&butter{}`: Does NOT add to the shopping list. (Use for instructions like "Add the reserved butter").
    ```gram
    Add @flour{200g} [...], then drench the chicken in this @&flour{}.
    ```
  - `-` **Hidden**. Hidden in the list, only appears inline. Also works for cookware.
    ```gram
    Add some @-salt{}.
    ```
  - `?` **Optional**. Mark the ingredient as optional. Also works for cookware.
    ```gram
    Now you can add @?thyme{}.
    ```
  - `*` **Baker's percentage**. Mark the ingredient as a reference (100%) to calculate baker's percentage.

## Intermediate preparations

You can refer to intermediate preparations as ingredients. It should be written **at the end of a step** (paragraph). The created reference captures all ingredients used in that step.

```gram
Add @flour{200g} and @water{}. Mix until combined. ->&dough{}

Let the &dough{} rest for ~{1 h}.
```

You can also declare an intermediate preparation at the end of a section title. This is useful when an entire section produces a component used later.

```gram
## Puff Pastry ->&puff pastry{}

Mix @flour{250g} and @butter{200g}...
```
Then refer to it later:
```gram
Use the &puff pastry{} to line the tart tin.
```
You can also specify a quantity for display purposes:
```gram
Take &puff pastry{200g} and roll it out.
```

Here, `&dough{}` is refering to the declared ingredient `->&dough{}`.
These ingredients will not appear in the shopping list.

**Note:** Any declared intermediate preparation MUST be used (referenced) in a subsequent step. Unused declarations will trigger a warning.

## Composite ingredients
 
You can define ingredients (children) that are drawn from another ingredient (parent).
See full documentation in [08_composite_ingredients.md](./08_composite_ingredients.md).

### Syntax
`@child{qty}<@parent{parentQty}`.
If `parentQty` is omitted (e.g., `<@lemon{}` or `<@lemon`), it defaults to **1**.

```gram
Add the @zest{1}<@lemon{}. // Costs 1 Lemon
Then add the @juice{1}<@lemon{}. // Costs 1 Lemon
```

### Calculation Rules
1.  **MAX Rule**: Different parts of the same parent (zest vs juice) share the parent. The highest cost wins.
2.  **SUM Rule**: Same part used multiple times adds up.
3.  **Aggregation**: Mixes with direct usages (`@lemon{2}`).

**Example**:
```gram
@zest{1}<@lemon{}       // Need 1
@juice{1}<@lemon{}      // Need 1 (Covered by the one above)
@lemon{2}               // Direct use
```
**Total Shopping List**: 3 Lemons.

## Component alias

You can rename an ingredient for display purposes using square brackets `[]` immediately after the name. This is useful to shorten long names or clarify references.

Format: `@Real Name[Display Name]{Quantity}`

```gram
@white wine[wine]{}
@-tomato sauce[sauce]{}     // works with modifiers too
```

This can be useful with references. Here, the references will be displayed as
`flour` even though the ingredient it's refering is `tipo zero flour`.

```gram
Add the @tipo zero flour{}
Add more @&tipo zero flour[flour]{}
```

This also works for cookware.

## Alternatives

You can define alternatives for an ingredient when it can be swapped for another ingredient.

```gram
@milk{100ml}|@water{95ml}
```

It also works with shorthand preparations :

```gram
@onion{1}(peeled and finely chopped)|@shallots{2}(peeled and minced)
```

You can also use alternatives for cookware:

```gram
#pan{}|#wok{}
```

## Temperature

Temperatures use the `!` symbol.
**Rule:** Temperatures MUST specify a unit.

Supported units:
- `°C` (Celsius).
- `°F` (Fahrenheit).

```gram
Preheat the #oven to !{180°C}.
```

Just like timers, temperatures can have a name too:

```gram
Preheat the #oven to !oven{180°C}.
```

Text descriptions without units are **NOT** allowed inside the tag. Use plain text instead.
`Cook on high heat.` (Correct)
`Cook on !stove{high heat}` (Invalid)

## Range values

Recipes are not always exact. This is a little improvement that should help
comunicating that in some cases.

```gram
@eggs{2-4}
@tomato sauce{200-300ml}            // works with units
@water{1.5-2l}                      // with decimal numbers too
@flour{1/2-2cup}                    // with fractions numbers too
@flour{100g} ... @&flour{200-400g} // the total will be 300-500 g
```