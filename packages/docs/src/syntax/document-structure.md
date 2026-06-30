# Document Structure

A Gram recipe file (`.gram`) is structured into several distinct parts: Metadata, Sections, Steps, and Comments.

## 1. Metadata (Frontmatter)

The frontmatter is a **YAML** block at the very start of the file, enclosed by `---`.

The Gram parser accepts **any** key-value pair in this block. You can add custom fields for your own application's needs. However, the Gram Compiler recognizes two types of keys: **Functional** and **Informational**.

### Functional Keys
These keys directly alter how the Gram Compiler processes the recipe:

*   `portions`: (Integer) The baseline number of servings. Used as the foundation for the [Nutritional Estimation](../engine/analyzer.md).
*   `densities`: (Object) Custom density overrides for specific ingredients, used by the [Mass Normalization](../engine/kitchen.md) algorithm.

### Informational Keys
These keys are recommended for proper display and metadata management:

*   `title`: The recipe name.
*   `originalTitle`: The recipe name in its original language (e.g., Japanese, Italian).
*   `description`: A short summary (useful for SEO meta tags).
*   `tags`: A list of categories or keywords.
*   `category`: Main category (e.g. "Dessert", "Main Course").
*   `author`: Name or list of authors.
*   `source`: URL(s) to the original recipe.
*   `date`, `lastUpdated`: YYYY-MM-DD.
*   `size`: Serving size description or dimensions (e.g. "20x20cm mold").
*   `notes`: General notes about the recipe (e.g. "Tested on 2026-06-07. Decrease sugar next time.").

::: code-group
```gram [recipe.gram]
---
title: 'Matcha Brownies'
originalTitle: '抹茶ブラウニー'
description: 'A simple Japanese-style matcha brownie...'
author: ["Auguste Kerflec"]
tags: ['brownie', 'matcha']
category: 'Dessert'
source: ['https://example.com/matcha-brownie']
size: '20x20cm'

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

Complex recipes often have multiple components (e.g., dough, filling, frosting) that are prepared separately. You can group steps into sections using Markdown-style headings (e.g., `## Dough`).

```gram
## Dough

Mix @flour{200g} and @water{100ml} together until smooth.

## Filling

Combine @cheese{100g} and @spinach{50g}, then season to taste.
```

### Retro-planning (Scheduling)
You can assign a preparation timeframe to a section by adding a timer `~{-...}` anywhere in the section title.

```gram
## Puff Pastry ~{-2d}
```
This tells the compiler that the "Puff Pastry" section should be prepared **2 days in advance**.
Supported suffixes are `d` (days), `h` (hours), `min` or `m` (minutes).

### Section Outputs (Declarations)
If a section produces a sub-component that will be used later in the recipe, you can declare it using `->&` at the end of the title.

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

::: warning Recipe Notes vs Comments
Comments are stripped during compilation. If you want a note to be visible in the final rendered recipe app (e.g., "Decrease sugar next time"), put it in the YAML Frontmatter under the `notes` key instead of using a comment.
:::
