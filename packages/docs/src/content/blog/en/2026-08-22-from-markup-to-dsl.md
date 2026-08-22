---
title: "From text markup to a compiler: from Cooklang to Gram"
date: 2026-08-22
locale: "en"
topic: "Devlog"
description: "Why simple text markup showed its limits for complex cooking, and how Gram evolved into a full domain-specific language (DSL)."
---

When I first started looking into writing recipes in plain text, I quickly came across [Cooklang](https://cooklang.org), created by Alex Dubowski. The premise is very appealing: rather than locking recipes into proprietary apps or rigid databases, you write in plain text with a few subtle syntactic annotations (`@flour{200%g}`, `#mixing bowl{}`, `~{15%minutes}`) to automatically extract useful data (ingredients, equipment, cooking times...).

For everyday home recipes, this approach works really well. But as I started writing more complex formulas (especially in pastry and artisan baking), I began running into the limits of simple text markup.

That is what led me to build **Gram**: not to replace Cooklang, but to explore a different direction, closer to a compiler and a dedicated domain-specific language (DSL).

## Where text markup hits its limits

The moment a recipe involves multiple stages or sub-preparations, instructions behave much more like a dependency graph than a simple linear list.

A few specific, common culinary scenarios pushed me to rethink the architecture:

### 1. Intermediate preparations
In complex cooking, the outcome of one step (a dough, a custard, a stock) often becomes the base ingredient for the next.

With standard text markup, you face a dilemma:
* Either you name the preparation in free text, and tooling loses the connection between steps.
* Or you re-list all base ingredients at each step, which risks multiplying quantities and corrupting the shopping list.

In Gram, these intermediate results become inline variables (`->&dough`) that you can reference downstream (`&dough`), without ever duplicating raw ingredients.

### 2. Composite ingredients
In baking, it is common to whip 4 egg whites for a meringue in step one, and use the 4 egg yolks for a custard in step two.

If a tool naively extracts `@egg whites{4}` and `@egg yolks{4}`, the shopping list might suggest you need 8 whole eggs instead of 4.

Gram introduces composite relationships (`@egg whites{4}<@eggs{4}`) so the compiler understands where ingredients come from and correctly aggregates them to 4 whole eggs.

### 3. Reusable bases (`@use`)
You don't necessarily want to rewrite a shortcrust pastry or stock recipe every time you make a dessert.

With the `@use "pie-crust.gram"` directive, Gram imports external recipes. During compilation, it measures the physical mass of the base and automatically scales its quantities to fit the main dish, while merging its raw ingredients into the overall shopping list.

### 4. Time optimization and retro-planning
In the kitchen, time is non-linear. A recipe continuously alternates between active work (chopping, mixing, kneading) and passive waiting (proofing dough, baking in the oven, resting in the fridge).

When cooking, you don't stand idle in front of the oven: you take advantage of a 40-minute bake time to prepare the filling or clean up. Similarly, if a dessert requires 12 hours of chilling (`## Dough ~{-1d}`), the cook needs to know exactly when to start the day before so everything is ready for dinner.

Gram analyzes these constraints to generate an optimized timeline: it automatically interleaves active tasks during passive waiting periods and calculates the ideal start time for each step (retro-planning) so the meal is perfectly synchronized for service.

## Two approaches for two needs

By introducing these concepts, Gram naturally moved away from Cooklang's initial simplicity. It is an intentional trade-off between two different visions:

* **Cooklang provides a complete suite for managing and cooking everyday recipes:**  
  The syntax focuses on essentials and remains very subtle when reading. Around this format, Cooklang offers a rich, mature suite of user tools: a dedicated desktop editor (Cook Editor), mobile apps with sync, a self-hosted web server, web recipe scrapers, and plugins for multiple text editors. Everything is designed to effortlessly capture, organize, and cook daily meals.

* **Gram focuses on graph modeling and computational integrity:**  
  Gram is built like a compiler: it relies on a formal grammar, an Abstract Syntax Tree (AST), a Language Server (LSP) with semantic diagnostics, a physical analysis engine (mass standardization, nutrition), and a scheduling solver. It requires slightly more discipline when writing, but guarantees full relational consistency for complex formulas and culinary software.

## A journey that is just beginning

Cooklang laid the groundwork for modern plain-text recipe writing and now enjoys an active community alongside a remarkably mature suite of tools.

Gram is only at the beginning of its journey. While the foundations of the language, compiler, and analyzer are solid, there is still a long way to go to build an ecosystem of such scale. My goal is to keep refining the syntax, expanding computational features and tooling, and seeing a community gradually take ownership of the project—whether to design new visualizers (flowcharts, Gantt schedules), integrate with other software, or simply share technical recipes.

Both formats have their place: Cooklang's simplicity and proven ecosystem for daily recipe notebooks, and Gram's relational structure for technical cooks and developers who want to treat recipes as code.
