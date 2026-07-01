# How to Scale Recipes Dynamically

Gram is designed to ensure that recipes scale mathematically. While you can easily scale any standard recipe linearly by passing a multiplier to the CLI (`gram build --scale 2`), Gram also offers a powerful advanced feature for ratio-based cooking (like pastry or bread): **Relative Quantities**.

This guide shows you how to use **Relative Quantities** to build dynamic, self-documenting recipes based on ratios (a practice most famously known in the baking world as *Baker's Percentages*).

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

In professional baking and pastry, ingredients are often expressed as a percentage of a main ingredient (usually the total flour weight). This concept is called **Baker's Percentage**.

In Gram, you can apply this logic to *any* reference ingredient using the language's **Relative Quantities** feature (`% @&target`).

### 1. Define the Anchor (Target)
First, define the flour as a standard ingredient and give it an intermediate variable declaration so it can be referenced.

```gram
Add the @flour{500g}. ->&flour
```

### 2. Define the Relatives
Now, replace the static quantities of water, salt, and yeast with percentages pointing to `&flour`.

```gram
Add the @flour{500g}. ->&flour
Pour in the @water{70% @&flour}, @salt{2% @&flour}, and @yeast{1% @&flour}.
```

## Scaling the Dynamic Recipe

Now, when you compile or view this recipe, Gram resolves the percentages automatically:
- Water: 70% of 500g = 350g
- Salt: 2% of 500g = 10g
- Yeast: 1% of 500g = 5g

### The Real Magic: Modifying Recipes

Because the relationships are encoded directly in the recipe, the source code becomes **self-documenting**. Any baker reading your `.gram` file immediately sees that this is a 70% hydration dough. 

If you want to tweak the recipe to a wetter 75% hydration, you just change one number:
```gram
Pour in the @water{75% @&flour}
```
Gram handles the math. You never have to manually calculate absolute weights again when designing or tweaking your recipes.

### CLI Scaling still works!

And of course, just like absolute recipes, you can still scale the total output dynamically from the CLI based on what you have in your pantry:

```bash
gram view bread.gram --scale flour=400g
```

Gram will compute the global factor (400/500 = 0.8), scale the anchor (flour) to 400g, and the relative ingredients will perfectly evaluate against this new base (Water: 70% of 400g = 280g).

## Scaling Fixed Ingredients

Sometimes, a recipe contains ingredients that **should never scale**, regardless of how many portions you make. For example, frying oil in a pan, or a pinch of salt.

You can use the **Fixed Modifier** (`=`) to protect an ingredient from scaling:

```gram
Heat @=frying oil{1L} in a deep pan.
```

If you run `gram build --scale 2`, the `frying oil` will remain at `1L`.

## Summary
By combining **Relative Quantities** for ratios and **Fixed Quantities** for non-scaling constants, you can write recipes that adapt perfectly to any pantry constraint or portion size.
