# How to Scale Recipes Dynamically

Gram is designed to ensure that recipes scale mathematically. While you can easily scale any standard recipe linearly by passing a multiplier to the CLI (`gram build --scale 2`), Gram also offers two powerful advanced features for ratio-based cooking (like pastry or bread): **Relative Quantities** and **Baker's Math**.

This guide shows you how to use **Relative Quantities** to build dynamic, self-documenting recipes based on ratios, and how to use **Baker's Math** to display traditional recipes in percentage format.

## The Limit of Static Quantities

Imagine a bread recipe:
```gram
@flour{500g}
@water{350ml}
@salt{10g}
@yeast{5g}
```

If you scale this by 2 using the CLI (`gram build --scale 2`), everything doubles. And if you only have `400g` of flour left, you can use reference scaling: `gram build --scale flour=400g`. Gram will compute the multiplier (`0.8`) and adjust everything automatically.

So why would we need anything else?

The problem arises **when you want to modify the recipe itself**. 
What if you want to increase the hydration from 70% to 75%? You would have to manually calculate what 75% of 500g is, and change `350ml` to `375ml`. The recipe's underlying logic (the ratios) is hidden behind static numbers, making it hard to read and hard to tweak.

## The Solution for Ratio-Based Recipes: Relative Quantities

Some recipes are fundamentally built around the mathematical relationship between ingredients, rather than strict absolute quantities (e.g., a bread dough defined by its 70% hydration).

In Gram, you can express these relationships directly in the source code using **Relative Quantities** (`% @&target` for ingredients, or `% &target` for intermediate variables). This allows the recipe to recalculate itself dynamically when you tweak a single percentage.

### 1. Define the Anchor (Target)
First, define the flour as a standard ingredient in your recipe.

```gram
Add the @flour{500g}.
```

### 2. Define the Relatives
Now, replace the static quantities of water, salt, and yeast with percentages pointing to the flour. Since the flour was already defined in a previous step, you reference it using `@&flour`.

```gram
[Add] The @flour{500g}.

[Pour in] The @water{70% @&flour}, @salt{2% @&flour}, and @yeast{1% @&flour}.
```

> **Tip:** You can also define an intermediate variable (e.g., a mixture) using `->&dough` and then calculate a relative quantity against it using `&dough` (e.g., `@salt{2% &dough}`). The syntax naturally follows how you reference items in Gram!

## Scaling the Dynamic Recipe

Now, when you compile or view this recipe, Gram resolves the percentages automatically:
- Water: 70% of 500g = 350g
- Salt: 2% of 500g = 10g
- Yeast: 1% of 500g = 5g

### The Real Magic: Modifying Recipes

Because the relationships are encoded directly in the recipe, the source code becomes **self-documenting**. Any baker reading your `.gram` file immediately sees that this is a 70% hydration dough. 

If you want to tweak the recipe to a wetter 75% hydration, you just change one number:
```gram
[Pour in] The @water{75% @&flour}
```
Gram handles the math. You never have to manually calculate absolute weights again when designing or tweaking your recipes.

### CLI Scaling still works!

And of course, just like absolute recipes, you can still scale the total output dynamically from the CLI based on what you have in your pantry:

```bash
gram view bread.gram --scale flour=400g
```

Gram will compute the global factor (400/500 = 0.8), scale the anchor (flour) to 400g, and the relative ingredients will perfectly evaluate against this new base (Water: 70% of 400g = 280g).

## Baker's Math Mode (CLI)

While Relative Quantities are great for *designing* dynamic recipes, professional bakers often use a concept called **Baker's Percentage** to read and analyze *static* recipes. In Baker's Percentage, the main ingredient (usually flour) is defined as 100%, and everything else is displayed as a percentage of that weight.

If you have a standard recipe with absolute weights, you can use the **Baker's Percentage Modifier** (`*`) to explicitly tell Gram: *"This ingredient is the 100% reference point"*.

```gram
[Add] The @*flour{500g}, @water{350g} and @salt{10g}.
```

When using the CLI, you can display the entire recipe in percentages without changing the source code, using the `--bakers-math` flag:

```bash
gram view bread.gram --bakers-math
```

The output will automatically show the percentage for each ingredient relative to the flour:
```
  flour                  100% (500 g)
  water                  70% (350 g)
  salt                   2% (10 g)
```

If your recipe does not include the `@*` modifier, you can still force baker's math by specifying the reference ingredient directly in the CLI:

```bash
gram view bread.gram --bakers-math=flour
```

If you only want to see the percentages and hide the absolute weights completely, add the `--bakers-math-only` flag.

## Scaling Fixed Ingredients

Sometimes, a recipe contains ingredients that **should never scale**, regardless of how many portions you make. For example, frying oil in a pan, or a pinch of salt.

You can use the **Fixed Modifier** (`=`) to protect an ingredient from scaling:

```gram
Heat @=frying oil{1L} in a deep pan.
```

If you run `gram build --scale 2`, the `frying oil` will remain at `1L`.

## Summary
By combining **Relative Quantities** for ratios and **Fixed Quantities** for non-scaling constants, you can write recipes that adapt perfectly to any pantry constraint or portion size.
