# Tutorial: Your First Complex Recipe

Time to bake! In this tutorial, a complete recipe for a **Lemon Meringue Tart** is written.

This recipe demonstrates how to move beyond a simple list of ingredients and use Gram's advanced compiler features to write a truly dynamic, scalable, and data-driven recipe.

## Step 1: The Basics (The Dough)

Start by defining the sweet pastry dough. The `@` symbol is used for ingredients and `#` for cookware.

```gram
## Sweet Pastry Dough

In a #bowl{}, mix the @flour{250g}, @icing sugar{100g}, and a @pinch of salt:salt{1 pinch}.
Add the @cold butter{150g} and mix until sandy.
Add @egg{1} and mix until the dough comes together. 
Wrap in plastic and let it rest in the fridge for ~{1h}.
```

This is very readable! The compiler will automatically extract the ingredients into a shopping list and sum the active time (assuming 2 minutes per step by default) plus the 1-hour timer.

## Step 2: Intermediate Variables

The dough is currently just a list of steps. To use this dough later (to bake it), the compiler must be told that the result of this section is a unified entity.

This is done using an **Intermediate Declaration** (`->&name`) at the end of the section.

```gram
## Sweet Pastry Dough

In a #bowl{}, mix the @flour{250g}, @icing sugar{100g}, and a @pinch of salt:salt{1 pinch}.
Add the @cold butter{150g} and mix until sandy.
Add @egg{1} and mix until the dough comes together. 
Wrap in plastic and let it rest in the fridge for ~{1h}.

->&pastry_dough
```

Now, in the next section, this dough can be referenced using `&name` instead of re-typing the ingredients. The compiler knows **not to add the dough to the shopping list**, because it's an intermediate preparation!

```gram
## Baking the Tart Shell

Preheat the #oven{} to °{180°C}.
Roll out the @&pastry_dough and place it in a #tart ring{}.
Bake for ~{20min} until golden.
```

## Step 3: Background Timers

In Step 1, the following was written: `let it rest in the fridge for ~{1h}`. 
By default, timers are **synchronous**. The compiler assumes you are actively waiting for 1 hour, and adds it to your *Active Time*.

But resting dough in the fridge is a passive task. You can do other things while it rests (like making the lemon curd). To tell the compiler this is a background task, add an ampersand `~&`:

```gram
Wrap in plastic and let it rest in the fridge for ~&{1h}.
```

Now, the compiler will subtract 1 hour from your *Active Time* but keep it in the *Total Time*.

## Step 4: Composite Ingredients

A lemon tart requires lemon zest and lemon juice. If you write `@lemon zest{10g}` and `@lemon juice{50ml}`, the shopping list will treat them as two completely different products. But lemons are bought whole!

This is solved using **Composite Ingredients** (`<@parent`).

Here is the Lemon Curd section:

```gram
## Lemon Curd

Zest the lemons to get @zest{10g}<@lemon and juice them to get @juice{100ml}<@lemon.
In a #saucepan{}, whisk the juice, zest, @sugar{150g}, and @egg{3}.
Cook over °{medium heat} until thickened.
```

Because both the zest and the juice point to `<@lemon`, the Gram Analyzer will use its database to calculate exactly how many whole lemons you need to buy to yield 10g of zest and 100ml of juice. 

## Step 5: Relative Quantities (Baker's Percentages)

For example, to make sure the lemon curd is perfectly balanced, no matter how much the recipe is scaled, the sugar must always be exactly 150% of the weight of the lemon juice.

You can use **Relative Quantities** (`% @&target`):

```gram
In a #saucepan{}, whisk the juice, zest, @sugar{150% @&juice}, and @egg{3}.
```

If you scale the recipe to make a massive tart, Gram will first calculate the mass of the juice, and then automatically compute the required mass of sugar.

## The Final Recipe

Here is the complete, compiled recipe. Notice how clean and readable it remains, despite packing an incredible amount of logic!

```gram
---
title: Lemon Meringue Tart
portions: 8
---

## Sweet Pastry Dough

In a #bowl{}, mix the @flour{250g}, @icing sugar{100g}, and a @pinch of salt:salt{1 pinch}.
Add the @cold butter{150g} and mix until sandy.
Add @egg{1} and mix until the dough comes together. 
Wrap in plastic and let it rest in the fridge for ~&{1h}.

->&pastry_dough

## Lemon Curd

Zest the lemons to get @zest{10g}<@lemon and juice them to get @juice{100ml}<@lemon.
In a #saucepan{}, whisk the juice, zest, @sugar{150% @&juice}, and @egg{3}.
Cook over °{medium heat} until thickened.
Add @cold butter{100g} and blend until smooth.

->&curd

## Baking the Tart Shell

Preheat the #oven{} to °{180°C}.
Roll out the @&pastry_dough and place it in a #tart ring{}.
Bake for ~{20min} until golden. Let cool.

## Assembly

Pour the @&curd into the baked shell. Chill in the fridge for ~&{2h}.
```

### What did the compiler do?
By running `gram view tart.gram`, the compiler will output:
- **Active Time**: ~25 mins (it ignored the 3 hours of fridge time).
- **Total Time**: ~3h 25 mins.
- **Shopping List**: It grouped the `@egg{1}` and `@egg{3}` into `4 eggs`. It calculated the whole lemons needed for the zest and juice. It scaled the sugar based on the lemon juice. 

You've just written a highly scalable, data-driven recipe!
