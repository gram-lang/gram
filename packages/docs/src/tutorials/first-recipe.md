# Tutorial: Your First Complex Recipe

Time to bake! In this tutorial, a complete recipe for a **Lemon Tart** is written.

This recipe demonstrates how to move beyond a simple list of ingredients and use Gram's advanced compiler features to write a truly dynamic, scalable, and data-driven recipe.

## Step 1: The Basics (The Dough)

Start by defining the sweet pastry dough. The `@` symbol is used for ingredients and `#` for cookware.

```gram
## Sweet Pastry Dough

[Process] In a #food processor{}, the @flour{180g}, @icing sugar{55g}, and @salt{1/4 tsp}.

[Crumble] Add the @butter{115g}(cold, cut into small cubes) and mix until sandy.

[Combine] Add the @egg{1}, @?vanilla extract{1/2 tsp} and mix until the dough comes together. 

[Rest] Wrap in plastic and let it rest in the fridge for ~{1h}.
```

Notice the `[Action]` tags at the start of each line (e.g., `[Process]`, `[Rest]`). While not strictly required, it is a highly recommended convention to start each step with its main action enclosed in brackets. This allows UI tools to generate clean, step-by-step summary views of your recipe.

Furthermore, this syntax is highly readable. The compiler will automatically extract the ingredients into a shopping list and sum the active time (assuming 2 minutes per step by default) plus the 1-hour timer.

## Step 2: Intermediate Variables

The dough is currently just a list of steps. To use this dough later (to bake it), the compiler must be told that the result of this section is a unified entity.

This is done using an **Intermediate Declaration** (`->&name`) at the end of the section title.

```gram
## Sweet Pastry Dough ->&pastry dough{}

[Process] In a #food processor{}, the @flour{180g}, @icing sugar{55g}, and @salt{1/4 tsp}.

[Crumble] Add the @butter{115g}(cold, cut into small cubes) and mix until sandy.

[Combine] Add the @egg{1}, @?vanilla extract{1/2 tsp} and mix until the dough comes together. 

[Rest] Wrap in plastic and let it rest in the fridge for ~{1h}.
```

Now, in the next section, this dough can be referenced using `&name` instead of re-typing the ingredients. The compiler knows **not to add the dough to the shopping list**, because it's an intermediate preparation!

```gram
## Baking the Tart Shell

[Preheat] Preheat the #oven{} to °{350°F}.

[Roll] Roll out the &pastry dough{} and place it in a #tart ring{}.

[Bake] For ~{20min} until golden.
```

## Step 3: Background Timers

In Step 1, the following was written: `[Rest] Wrap in plastic and let it rest in the fridge for ~{1h}`. 
By default, timers are **synchronous**. The compiler assumes you are actively waiting for 1 hour, and adds it to your *Active Time*.

But resting dough in the fridge is a passive task. You can do other things while it rests (like making the lemon curd). To tell the compiler this is a background task, add an ampersand `~&`:

```gram
[Rest] Wrap in plastic and let it rest in the fridge for ~&{1h}.
```

Now, the compiler will subtract 1 hour from your *Active Time* but keep it in the *Total Time*.

## Step 4: Composite Ingredients

A lemon tart requires lemon zest and lemon juice. If you write `@lemon zest{1 tbsp}` and `@lemon juice{120ml}`, the shopping list will treat them as two completely different products. But lemons are bought whole!

This is solved using **Composite Ingredients** (`<@parent`).

Here is the Lemon Curd section:

```gram
## Lemon Curd

[Whisk] In a #saucepan{}, whisk the @lemon zest{1 tbsp}<@lemon, @lemon juice{120ml}<@lemon{2}, @sugar{150g}, and @eggs{3}.

[Cook] Cook over °{medium heat} until thickened.
```

Because both the zest and the juice point to `<@lemon`, the compiler understands they are different parts of the same parent ingredient. Rather than relying on a database to guess yields, it applies the **MAX Rule**: it looks at the parent quantities required for each *distinct* part (`<@lemon` defaults to 1 for the zest, and `<@lemon{2}` for the juice) and takes the maximum. Here, since `max(1, 2) = 2`, the shopping list will smartly require exactly 2 whole lemons!

## Step 5: Relative Quantities

In pastry, precision is key. What if your lemons are particularly juicy and yield 140ml of juice instead of the expected 120ml? If your sugar was a fixed amount, the curd would become too tart. To ensure the curd is perfectly balanced regardless of the real-life yield, the sugar must dynamically adjust to be exactly 150% of the weight of the juice.

You can use **Relative Quantities** (`% @&target`):

```gram
[Whisk] In a #saucepan{}, the @lemon zest{1 tbsp}<@lemon, @lemon juice{120ml}<@lemon{2}, @sugar{125% @&lemon juice}, and @eggs{3}.
```

Now, the sugar is strictly bound to the juice. If you adjust the juice amount later based on the actual yield of your lemons, the compiler will automatically compute the exact mass of sugar needed to maintain the perfect ratio.

## The Final Recipe

Here is the complete, compiled recipe. Notice how clean and readable it remains, despite packing an incredible amount of logic!

```gram
---
title: Lemon Meringue Tart
portions: 8
---

## Sweet Pastry Dough ->&pastry dough{}

[Process] In a #food processor{}, the @flour{180g}, @icing sugar{55g}, and @salt{1/4 tsp}.

[Crumble] Add the @butter{115g}(cold, cut into small cubes) and mix until sandy.

[Combine] Add the @egg{1}, @?vanilla extract{1/2 tsp} and mix until the dough comes together. 

[Rest] Wrap in plastic and let it rest in the fridge for ~{1h}.

## Lemon Curd ->&curd

[Whisk] In a #saucepan{}, the @lemon zest{1 tbsp}<@lemon, @lemon juice{120ml}<@lemon{2}, @sugar{125% @&lemon juice}, and @eggs{3}.

[Cook] Over °{medium heat} until thickened.

## Baking the Tart Shell ->&baked shell{}

[Preheat] The #oven{} to °{180°C}.

[Roll out] The &pastry dough{} and place it in a #tart ring{}.

[Bake] For ~{20min} until golden. Let cool.

## Assembly

[Pour] The &curd into the &baked shell{}. Chill in the fridge for ~&{2h}.
```

### What did the compiler do?
By running `gram view lemon-tart.gram`, the compiler will output:
- **Active Time**: ~25 mins (it ignored the 3 hours of fridge time).
- **Total Time**: ~3h 25 mins.
- **Shopping List**: It grouped the `@egg{1}` and `@egg{3}` into `4 eggs`. It calculated the whole lemons needed for the zest and juice. It scaled the sugar based on the lemon juice. 

You've just written a highly scalable, data-driven recipe!
