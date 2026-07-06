# Rendering & Output (`@gram-lang/renderer`)

Once a recipe has been parsed by `@gram-lang/parser`, compiled by `@gram-lang/kitchen`, and (optionally) enriched by `@gram-lang/analyzer`, it's ready to be presented to the user.

The `@gram-lang/renderer` package takes this final enriched JSON object and transforms it into structured Markdown or semantic HTML.

## Rendering Formats

The renderer supports three output formats:

### 1. Markdown (`toMarkdown`)
Generates standard Markdown that includes a formatted shopping list, an equipment section, and clearly numbered steps. This is perfect for publishing recipes to static site generators (like VitePress or Hugo) or saving them to a notes app like Obsidian.

### 2. Semantic HTML (`toHTML`)
Generates a standalone, semantic HTML document. The HTML renderer is designed with an **Inversion of Control** architecture, allowing you to inject custom CSS classes and SVG icons to match your application's design system.

### 3. Print HTML (`toPrintHTML`)
Generates a complete, self-contained `<!DOCTYPE html>` document with its own inlined print stylesheet (A4 page size, page-break-aware sections) and a fixed icon set — designed to be opened directly in a browser and printed, with no external stylesheet or asset dependency. Unlike `toHTML`, it does not accept custom `icons`/`classes` overrides, but it does honor `formatDuration`, `formatFraction`, and `hideStepQty`.

## Usage Example

```typescript
import { toMarkdown, toHTML } from '@gram-lang/renderer';

// Assuming `recipe` is the output from @gram-lang/kitchen or @gram-lang/analyzer
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

`RendererOptions` also exposes `bakersReference`/`bakersMathOnly` (to display baker's-percentage math) and `hideStepQty` (to omit ingredient quantities from step text specifically — note this currently only has an effect on `toPrintHTML`, not on `toMarkdown`/`toHTML`).

## Features

- **Fraction Formatting**: Converts decimals into readable fraction strings for common cooking amounts (e.g., `0.5` becomes `"1/2"`, `0.33` becomes `"1/3"`) for better readability in cooking contexts. These are plain text fractions (`1/2`), not single-glyph unicode characters.
- **Smart Escaping**: Automatically escapes HTML entities to prevent XSS injection from user-generated recipe content.
- **Duration Formatting**: Converts raw minute integers into human-readable strings (e.g., `90` becomes `1h 30m`).
- **CSS Pre-styling**: The package ships a `gram.css` stylesheet with live-preview theming (light/dark tokens for each element type, e.g. ingredients, timers). The dedicated print stylesheet used for `toPrintHTML` is a separate, inlined stylesheet — you don't need to load any CSS file yourself to use print output.

## Direct JSON Consumption

If you are building a modern web app (e.g., using React, Vue, or Svelte), you **do not** have to use `@gram-lang/renderer`.

The JSON output from `@gram-lang/analyzer` is structured and can be iterated over directly — mapping over `recipe.sections` and `recipe.shopping_list` covers the common case. Keep in mind that richer recipes can produce more varied shapes worth handling explicitly, such as ingredient alternatives/groups, composite ingredients, or items carrying `normalizedMass`, `purchasingMass`, and `bakersPercentage` — `@gram-lang/renderer`'s own formatting logic is a good reference for how to handle these if you're building a custom consumer.
