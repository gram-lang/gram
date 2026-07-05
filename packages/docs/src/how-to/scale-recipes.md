# How to Scale Recipes Dynamically

Gram is designed to ensure that recipes scale mathematically across its entire ecosystem. Whether you are using the interactive Playground, rendering HTML/Markdown documents, or running CLI commands, Gram natively supports two powerful features for ratio-based cooking (like pastry or bread): **Relative Quantities** and **Baker's Math**.

This guide shows you how to use **Relative Quantities** to build dynamic, self-documenting recipes based on ratios, and how to use **Baker's Math** to display traditional recipes in percentage format.

## The Limit of Static Quantities

Imagine a bread recipe:
```gram
[Mix] The @flour{500g}, @water{350ml}, @salt{10g} and @yeast{5g}.
```

If you scale this by 2 (e.g., using `gram build --scale 2`), everything doubles. And if you only have `400g` of flour left, you can use reference scaling: `gram build --scale flour=400g`. Gram will compute the multiplier (`0.8`) and adjust everything automatically.

So why would we need anything else?

The problem arises **when you want to modify the recipe itself**. 
What if you want to increase the hydration from 70% to 75%? You would have to manually calculate what 75% of 500g is, and change `350ml` to `375ml`. The recipe's underlying logic (the ratios) is hidden behind static numbers, making it hard to read and hard to tweak.

## The Solution for Ratio-Based Recipes: Relative Quantities

Some recipes are fundamentally built around the mathematical relationship between ingredients, rather than strict absolute quantities (e.g., a bread dough defined by its 70% hydration).

In Gram, you can express these relationships directly in the source code using **Relative Quantities** (`% @&target` for ingredients, or `% &target` for intermediate variables). This allows the recipe to recalculate itself dynamically when you tweak a single percentage.

### 1. Define the Anchor (Target)
First, define the flour as a standard ingredient in your recipe.

```gram
[Add] The @flour{500g}.
```

### 2. Define the Relatives
Now, replace the static quantities of water, salt, and yeast with percentages pointing to the flour. Since the flour was already defined in a previous step, you reference it using `@&flour`.

```gram
[Add] The @flour{500g}.

[Pour in] The @water{70% @&flour}, @salt{2% @&flour}, and @yeast{1% @&flour}.
```

> **Tip:** You can also define an intermediate variable (e.g., a mixture) using `->&dough` and then calculate a relative quantity against it using `&dough` (e.g., `@salt{2% &dough}`). The syntax naturally follows how you reference items in Gram!

## Scaling the Dynamic Recipe

Because the relationships are encoded directly in the recipe, Gram handles the math dynamically. Any baker reading your `.gram` file immediately sees that this is a 70% hydration dough. 

If you want to tweak the recipe to a wetter 75% hydration, you just change one number:
```gram
[Pour in] The @water{75% @&flour}
```
Gram handles the math. You never have to manually calculate absolute weights again when designing or tweaking your recipes.

### Universal Scaling

You can scale recipes visually in the Playground, or from the CLI using the `--scale` flag (available on `view`, `build`, `print`, and `export`):

```bash
gram view bread.gram --scale flour=400g
```

Gram will compute the global factor (400/500 = 0.8), scale the anchor (flour) to 400g, and the relative ingredients will perfectly evaluate against this new base (Water: 70% of 400g = 280g).

### Limits of Reference Scaling

Since scaling by reference derives the factor from an ingredient's own quantity, not every ingredient can be used as the target — only an ingredient with a genuine, standalone absolute quantity qualifies. If you pass one of the following, Gram rejects it with a specific error rather than silently computing a wrong factor:

| You tried to scale by... | Why it's rejected | What to do instead |
| :--- | :--- | :--- |
| A **relative quantity** (e.g. `water`, defined as `70% @&flour`) | Its value is *derived* from another ingredient — it can't also be the reference | Scale the anchor ingredient instead (`--scale flour=400g`) |
| A **fixed ingredient** (`@=`) or a text quantity like `a pinch` | It never scales, by definition, so it can't describe a scale factor either | Pick a different ingredient that actually changes with the recipe |
| An ingredient only used **inside** a sub-recipe (e.g. `lemon-zest`, part of a `<@lemon` composite) | It's not directly declared with its own quantity — only the composite parent has one | Scale the composite parent instead (e.g. `--scale lemon=4`) — its own total is a valid target |
| One option inside an **alternative-ingredient** group (`@butter{100g}|@margarine{100g}`) | Picking one option in isolation doesn't represent the either/or choice the recipe expresses | Scale a different, unambiguous ingredient elsewhere in the recipe |
| An ingredient split across **two incompatible units** in the recipe (e.g. `300g` in one step, `2 cups` in another) | The shopping list total can't be reduced to a single number to divide by | Rewrite the recipe to use one unit for that ingredient, or scale by a different one |
| A unit from a different physical family (e.g. `flour=1L` against a recipe in `g`) | Converting between mass and volume needs an ingredient-specific density | Add a density via `gram db enrich`, or match the recipe's unit family |

Units within the *same* family convert automatically — `--scale flour=1kg` against a recipe written in `500g` works out of the box (factor `2`), no database required.

## Baker's Math

While Relative Quantities are great for *designing* dynamic recipes, professional bakers often use a concept called **Baker's Percentage** to read and analyze *static* recipes. In Baker's Percentage, the main ingredient (usually flour) is defined as 100%, and everything else is displayed as a percentage of that weight.

If you have a standard recipe with absolute weights, you can use the **Baker's Percentage Modifier** (`*`) to explicitly tell Gram: *"This ingredient is the 100% reference point"*.

```gram
[Add] The @*flour{500g}, @water{350g} and @salt{10g}.
```

The parsed recipe will automatically compute these percentages for any frontend to display. 

When using the CLI, you can render these percentages by adding the `--bakers-math` flag:

```bash
gram view bread.gram --bakers-math
```

The output will automatically show the percentage for each ingredient relative to the flour:
```
  flour                  100% (500 g)
  water                  70% (350 g)
  salt                   2% (10 g)
```

If your recipe does not include the `@*` modifier, you can still force baker's math by explicitly specifying the reference ingredient on the fly:

```bash
gram view bread.gram --bakers-reference=flour
```

*(You can also use the `--bakers-math-only` flag if you want to hide the absolute weights completely.)*

## Scaling Fixed Ingredients

Sometimes, a recipe contains ingredients that **should never scale**, regardless of how many portions you make. For example, frying oil in a pan, or a pinch of salt.

You can use the **Fixed Modifier** (`=`) to protect an ingredient from scaling:

```gram
Heat @=frying oil{1L} in a deep pan.
```

If you run `gram build --scale 2`, the `frying oil` will remain at `1L`.

## Summary
By combining **Relative Quantities** for ratios and **Fixed Quantities** for non-scaling constants, you can write recipes that adapt perfectly to any pantry constraint or portion size.
