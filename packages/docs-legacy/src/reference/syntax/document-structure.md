# Document Structure

A Gram recipe file (`.gram`) is structured into several distinct parts: Metadata, Sections, Steps, and Comments.

## 1. Metadata (Frontmatter)

The frontmatter is a **YAML** block at the very start of the file, enclosed by `---`.

The Gram parser accepts **any** key-value pair in this block. You can add custom fields for your own application's needs. However, the Gram Compiler recognizes two types of keys: **Functional** and **Informational**.

### Functional Keys
These keys directly alter how the Gram Compiler processes the recipe:

*   `portions`: (Integer) The baseline number of servings. Used as the foundation for the [Nutritional Estimation](../../explanation/engine/analyzer.md).
*   `densities`: (Object) Custom density overrides for specific `@ingredient` items, used by the [Mass Standardization](../../explanation/engine/kitchen.md) algorithm.

### Informational Keys
These keys are recommended for proper display and metadata management:

*   `title`: The recipe name.
*   `description`: A short summary (useful for SEO meta tags).
*   `tags`: A list of categories or keywords.
*   `category`: Main category (e.g. "Dessert", "Main Course").
*   `author`: Name or list of authors.
*   `source`: URL(s) to the original recipe.
*   `date`, `lastUpdated`: YYYY-MM-DD.
*   `makes`: The physical output or dimensions of the recipe (e.g., "1 layer cake", "24 cookies", "20x20cm mold").
*   `notes`: General notes about the recipe (e.g. "Tested on 2026-06-07. Decrease sugar next time.").

::: code-group
```gram [recipe.gram]
---
title: 'Matcha Brownies'
description: 'A simple Japanese-style matcha brownie...'
author: ["Auguste Kerflec"]
tags: ['brownie', 'matcha']
category: 'Dessert'
source: ['https://example.com/matcha-brownie']
makes: '20x20cm mold'

# Functional Fields
portions: 4
densities:
  - flour: 0.55
---
```
:::

## 2. Steps

Each paragraph in a Gram file represents a single cooking step. Steps are separated by one or more empty lines.

```gram
A step,
the same step.

A different step.
```

### Action Verbs
Steps can optionally start with an **Action** enclosed in brackets `[]`. This highlights the primary method used in that step, making it easy to parse visually or programmatically.

```gram
[Mix] The @flour and @water.

[Bake] In the #oven for ~{30min}.
```

## 3. Sections

Complex recipes often have multiple components (e.g., dough, filling, frosting) that are prepared separately. You can group steps into `## Section` blocks using Markdown-style headings (e.g., `## Dough`).

```gram
## Dough

Mix @flour{200g} and @water{100ml} together until smooth.

## Filling

Combine @cheese{100g} and @spinach{50g}, then season to taste.
```

### Retro-planning (Scheduling)
You can assign a preparation timeframe to a `## Section` by adding a `~timer`-like annotation anywhere in the title.

```gram
## Puff Pastry ~{-2d}
```
This tells the compiler that the "Puff Pastry" `## Section` should be prepared **2 days in advance**.
Supported suffixes are `d` (days), `h` (hours), `min` or `m` (minutes) — free text (e.g. `~{the day before}`) is not valid here and is flagged by the compiler.

*See [Times & Scheduling](./times.md#section-retro-planning) for the full syntax rules and error handling.*

### Section Outputs (Declarations)
If a `## Section` produces a sub-component that will be used later in the recipe, you can declare it using `->&` at the end of the title.

```gram
## Puff Pastry ->&dough
```
*See [Intermediate Variables](./intermediate-variables.md) for more details.*

## 4. Comments

You can add comments to explain instructions without affecting the compiled output.

**Inline Comments (`//`)**:
```gram
Mash @potato{2kg} until smooth // alternatively, boil 'em first.
```

**Block Comments (`/* ... */`)**:
```gram
Slowly add @milk{4 cup} /* TODO change units to litres */, keep mixing.
```

::: info Comments vs YAML Notes
Comments are preserved during compilation and are rendered alongside the instructions (typically in grey italics). They are perfect for small, step-specific tips. However, if you have global observations or general feedback about the recipe (e.g., "Decrease sugar next time", "Best served cold"), it is recommended to put them in the YAML Frontmatter under the `notes` key so they can be displayed prominently at the top.
:::
