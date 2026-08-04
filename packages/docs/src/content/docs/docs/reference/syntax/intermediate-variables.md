---
title: "Intermediate Variables"
description: "Declare reusable sub-components like dough or sauce as intermediate &variables at the step or section level."
---

In complex recipes, you often create sub-components (like a dough, a sauce, or a frosting) that are then used in later steps. Gram allows you to declare these sub-components as **Intermediate Variables**.

Once declared, an intermediate `&variable` acts exactly like an `@ingredient`, allowing you to reference it, measure it, or calculate percentages from it.

## Declaring a Variable

You can declare a `&variable` using the `->&` syntax. There are two places you can declare them: at the end of a **Step**, or at the end of a **Section Title**.

### Step-level Declaration

When placed at the very end of a step (a paragraph), the `&variable` captures everything produced in that specific step.

```gram
[Add] @flour{200g} and @water{100ml}. Mix until combined. ->&dough

[Rest] Let the &dough rest for ~_{1h}.
```

### Section-level Declaration

When placed at the end of a `## Section` title, the `&variable` captures the output of the *entire* section. This is perfect for components that take several steps to prepare.

```gram
## Puff Pastry ->&puff pastry{}

[Mix] @flour{250g}, @water{120ml}, and @salt{5g}.

[Rest] In the #fridge for ~_{1h}.

[Incorporate] The @butter{200g} by folding the dough multiple times.

// The `&puff pastry` variable now contains the final result of all the steps above!
```

## Using a Variable

To use a previously declared `&variable`, simply reference it with `&`. 

```gram
Use the &puff pastry{} to line the tart tin.
```

You can also assign a quantity to it for display purposes in the rendered recipe:

```gram
Take &puff pastry{200g} and roll it out.
```

:::note[Shopping List vs Recipe Ingredients]
When you use an intermediate `&variable` in a later step, it **will** appear in the Recipe's ingredient list for that section, just like any regular ingredient. 

However, it **will not** appear in the global **Shopping List**. The Gram Compiler knows that the `&puff pastry` is made of flour and butter, and it will automatically unpack it and count the raw flour and butter towards your shopping list instead.
:::

## Advanced Mechanics

### Global Scoping
When a `&variable` is declared at the Section-level, it is registered in the **Global Scope**. This means you can declare a `&variable` in the first section of your recipe and safely reference it in the last section.

### Relative Quantities
As detailed in the [Relative Quantities](./relative-quantities.md) documentation, you can calculate the mass of an ingredient based on the total mass of an intermediate variable.

```gram
[Mix] The ingredients to form the dough. ->&dough

[Add] @salt{2% &dough}.
```

## Error Handling

The compiler helps you maintain clean and conflict-free code by emitting specific warnings:

- **Scope Conflict**: If you accidentally declare the same `&variable` name twice in different `## Section` blocks, the compiler will issue a `SCOPE_CONFLICT` warning.
- **Unused Variable**: Any `&variable` that is declared using `->&` **must** be used later in the recipe. If you declare a `&variable` but never reference it, the compiler will trigger a warning to help you keep your recipe code clean.
