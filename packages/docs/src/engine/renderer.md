# Rendering & Output (`@gram/renderer`)

Once a recipe has been parsed by `@gram/parser`, compiled by `@gram/kitchen`, and (optionally) enriched by `@gram/analyzer`, it's ready to be presented to the user. 

The `@gram/renderer` package takes this final enriched JSON object and transforms it into structured Markdown or semantic HTML.

## Rendering Formats

The renderer supports two primary output formats:

### 1. Markdown (`toMarkdown`)
Generates standard Markdown that includes a formatted shopping list, an equipment section, and clearly numbered steps. This is perfect for publishing recipes to static site generators (like VitePress or Hugo) or saving them to a notes app like Obsidian.

### 2. Semantic HTML (`toHTML`)
Generates a standalone, semantic HTML document. The HTML renderer is designed with an **Inversion of Control** architecture, allowing you to inject custom CSS classes and SVG icons to match your application's design system.

## Usage Example

```typescript
import { toMarkdown, toHTML } from '@gram/renderer';

// Assuming `recipe` is the output from @gram/kitchen or @gram/analyzer
const recipe = {
  title: "Simple Crepes",
  metrics: { totalTime: 30, activeTime: 10 },
  shopping_list: [
    { id: "flour", qty: 200, unit: "g" }
  ],
  sections: [
    {
      title: "Preparation",
      steps: [
        { type: "text", value: "Whisk everything together." }
      ]
    }
  ]
};

// 1. Simple Markdown rendering
const markdown = toMarkdown(recipe);

// 2. Customized HTML rendering with custom icons (Inversion of Control)
const html = toHTML(recipe, {
  icons: {
    clock: '<svg class="icon-clock">...</svg>',
    fire: '<svg class="icon-fire">...</svg>'
  },
  classes: {
    recipeTitle: "text-2xl font-bold custom-title",
    recipeMeta: "flex gap-2 text-gray-500"
  }
});
```

## Features

- **Fraction Formatting**: Automatically converts decimals into beautiful unicode fractions (e.g., `0.5` becomes `½`, `0.33` becomes `⅓`) for better readability in cooking contexts.
- **Smart Escaping**: Automatically escapes HTML entities to prevent XSS injection from user-generated recipe content.
- **Duration Formatting**: Converts raw minute integers into human-readable strings (e.g., `90` becomes `1h 30m`).
- **CSS Pre-styling**: Includes a `gram.css` file providing a clean, print-ready default stylesheet for HTML outputs if you don't want to bring your own styles.

## Direct JSON Consumption

If you are building a modern web app (e.g., using React, Vue, or Svelte), you **do not** have to use `@gram/renderer`. 

The JSON output from `@gram/analyzer` is heavily structured and easy to iterate over. You can simply map over `recipe.sections` and `recipe.shopping_list` to build your own custom components natively, rather than generating a raw HTML string.
