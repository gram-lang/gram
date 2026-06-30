# What is Gram?

Gram is a smart, data-driven recipe markup language designed specifically for developers. 

While traditional recipe formats are static blocks of text, Gram treats recipes as **code**. It compiles human-readable cooking instructions into structured, predictable JSON data. 

## The Philosophy

Cooking is an algorithm. A recipe is a function that takes raw ingredients as inputs and outputs a finished dish. 

Gram was built on this exact premise. By writing recipes in Gram, you unlock programmatic capabilities that are impossible with standard markdown or plain text:

::: tip Why use Gram?
- **Mass Normalization**: Automatically convert volumes (cups, spoons) to precise metric weights (grams) based on ingredient densities.
- **Yield Management**: Calculate purchasing weights based on the physical yield of ingredients (e.g., how many whole lemons to buy to get 50ml of juice).
- **Nutritional Estimation**: Automatically compute calories and macros based on portion sizes and ingredient databases.
- **Dynamic Scaling**: Scale portions linearly, or lock specific ingredients (like salt or yeast) to fixed quantities.
:::

## For Developers, By Developers

Gram is not just a syntax; it is a complete ecosystem for building culinary applications.

If you are building a recipe app, a meal planner, or a smart kitchen dashboard, parsing raw text is a nightmare. With Gram, you write recipes in a comfortable, markdown-like syntax, and the **Gram Compiler** (`@gram/kitchen`) processes it into a rich Abstract Syntax Tree (AST) and a normalized JSON output.

The ecosystem provides everything you need:
- **Parser & Analyzer**: For deep semantic analysis of recipes.
- **Language Server (LSP)**: For editor support (autocompletion, diagnostics).
- **CLI**: To compile, scale, and extract shopping lists from your terminal.

## How it looks

Here is a quick glimpse of what Gram looks like:

::: code-group

```gram [recipe.gram]
---
title: Simple Pancakes
portions: 2
---
## Batter ->&batter

Mix @flour{100g}, @milk{150ml}, and @eggs{2}.
Add a pinch of @=salt. // The '=' makes it a fixed quantity (won't scale)

## Cooking

Melt @butter{10g} in a #pan(large).
Pour the &batter and cook for ~{2min} on °stove{medium heat}.
```

```json [output.json]
{
  "title": "Simple Pancakes",
  "shopping_list": [
    { "id": "flour", "qty": 100, "unit": "g" },
    { "id": "milk", "qty": 150, "unit": "ml" },
    { "id": "eggs", "qty": 2, "unit": "unit" },
    { "id": "salt", "qty": null, "unit": "unit" },
    { "id": "butter", "qty": 10, "unit": "g" }
  ]
}
```

:::

Ready to dive in? Check out the [Getting Started](./getting-started.md) guide.