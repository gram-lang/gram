# How to Scale Recipes Dynamically

Gram is designed to ensure that recipes scale mathematically without breaking ratios. While you can always scale an entire recipe linearly by passing a multiplier to the CLI (`gram build --scale 2`), the best practice is to design your recipes so they scale *internally* using Baker's Percentages.

This guide shows you how to use **Relative Quantities** to build dynamic recipes.

## The Problem with Linear Scaling

Imagine a bread recipe:
```gram
@flour{500g}
@water{350ml}
@salt{10g}
@yeast{5g}
```

If you scale this by 2 (to make two loaves), everything doubles. But what if you only have `400g` of flour left in your pantry? 
You would need to calculate a multiplier (`400 / 500 = 0.8`), and manually multiply every other ingredient by `0.8`. This is tedious and prone to error.

## The Solution: Baker's Percentages

In professional baking, every ingredient is expressed as a percentage of the total flour weight. 
In Gram, this logic can be encoded directly into the recipe using `% @&target`.

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

But the real magic happens in the CLI.

### Scale by Reference
Because the relationships are encoded in the recipe, you can tell the CLI to scale the recipe based on a *single ingredient*.

Remember the scenario where you only have 400g of flour?

```bash
gram view bread.gram --scale flour=400g
```

Gram will first adjust the flour to 400g. Then, because the other ingredients are relative, it will recalculate them perfectly:
- Water: 70% of 400g = 280g
- Salt: 2% of 400g = 8g
- Yeast: 1% of 400g = 4g

## Scaling Fixed Ingredients

Sometimes, a recipe contains ingredients that **should never scale**, regardless of how many portions you make. For example, frying oil in a pan, or a pinch of salt.

You can use the **Fixed Modifier** (`=`) to protect an ingredient from scaling:

```gram
Heat @=frying oil{1L} in a deep pan.
```

If you run `gram build --scale 2`, the `frying oil` will remain at `1L`.

## Summary
By combining **Relative Quantities** for ratios and **Fixed Quantities** for non-scaling constants, you can write recipes that adapt perfectly to any pantry constraint or portion size.
