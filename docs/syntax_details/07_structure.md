# Recipe Structure

How to organize a complete `.gram` file.

## 1. Metadata (Frontmatter)

The file must start with a YAML block delimited by `---`.

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

*   **Retro-planning**: `{T-time}`. Indicates this section must be done in advance.
    *   `## Marinade {T-12h}` (12 hours before start).
*   **Output**: `->&variable`. (See Variables doc).

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

*   `// comment`: Until end of line.
*   `/* block */`: Multi-line or embedded comment.

```gram
Add @salt{} // Important for taste!
Mix /* be careful*/ the @egg whites{}.
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
