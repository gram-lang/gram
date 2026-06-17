# Recipe Structure

How to organize a complete `.gram` file.

## 1. Metadata (Frontmatter)

We recommand that the file starts with a YAML block delimited by `---`.

```yaml
---
title: My Recipe
author: Chef
tags: [dessert, easy]
# Metadata used by Compiler Features
portions: 4          # For Nutrition Calculation
densities:           # For Mass Unification
  - flour: 0.6
  - egg: 55
---
```

> Values like `densities` and `portions` are used by the **Smart Compiler**. See [Compiler Features](../compiler_features).

## 2. Sections (##)

Sections divide the recipe into major logical parts.

```gram
## Section Title
```

### Section Options

*   **Retro-planning**: `~{-time}`. Indicates this section must be done in advance.
    *   `## Marinade ~{-12h}` (12 hours before start).
*   **Output**: `->&variable`. (See Variables doc).

### The All-or-Nothing Rule
GRAM enforces a strict structure logic:
* **Implicit Mode:** If a recipe has **no** `##` sections at all, the entire body is treated as one single implicit section.
* **Explicit Mode:** If a recipe uses **at least one** `##` section, then **all steps must belong to a section**. You cannot place steps before the first `##` header or mix flat steps with sectioned steps. Doing so will trigger a compilation error. (Note: Comments can be placed anywhere).

## 3. Steps

One step = One paragraph.
Separate steps with an **empty line**.

### The Action `[Verb]`
It is highly recommended to start each step with an action in brackets.

```gram
[Mix] The ingredients...

[Bake] In the oven...
```

This allows tools to generate a "Matrix" (summary) view of the recipe.

## 4. Comments

Anything that isn't technical instruction should be a comment.
Comments can be placed anywhere in the file (even outside of sections).

*   `// comment`: Until end of line.
*   `/* block */`: Multi-line or embedded comment.

```gram
Add @salt // Important for taste!

Mix /* be careful*/ the @egg whites.

// Another comment
```

## Tree Summary

```text
Recipe
└── Meta (YAML)
└── Section 1
    └── Step 1
        └── [Action]
        └── Ingredients / Cookware
    └── Step 2
└── Section 2...
```
