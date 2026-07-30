---
title: "Rendering & Output (`@gram-lang/renderer`)"
---

Once a recipe has been parsed by `@gram-lang/parser`, compiled by `@gram-lang/kitchen`, and (optionally) enriched by `@gram-lang/analyzer`, it's ready to be presented to the user.

The `@gram-lang/renderer` package takes this final enriched JSON object and transforms it into structured Markdown or semantic HTML.

## Rendering Formats

The renderer supports four output formats:

### 1. Markdown (`toMarkdown`)
Generates standard Markdown that includes a formatted shopping list, equipment section, numbered steps, GFM footnotes (`[^1]`), gross mass badges, and an optional nutrition section (`## 🥗 Nutrition`). This is perfect for publishing recipes to static site generators (like VitePress or Hugo) or saving them to a notes app like Obsidian.

### 2. Semantic HTML (`toHTML`)
Generates a standalone, semantic HTML document. The HTML renderer is designed with an **Inversion of Control** architecture, allowing you to inject custom CSS classes and SVG icons to match your application's design system.

### 3. Print HTML (`toPrintHTML`)
Generates a complete, self-contained `<!DOCTYPE html>` document with its own inlined print stylesheet (A4 page size, page-break-aware sections) and a fixed icon set — designed to be opened directly in a browser and printed, with no external stylesheet or asset dependency. Unlike `toHTML`, it does not accept custom `icons`/`classes` overrides, but it does honor `formatDuration`, `formatFraction`, and `hideStepQty`.

### 4. Gantt Chart (`toGanttHTML` + `attachGanttInteractivity`)
Renders an interactive timeline view of the recipe — active preparation steps, background timers, and idle-time compression — as an HTML fragment. Unlike the three formatters above, this isn't a single pure function: `toGanttHTML` produces static markup (no time-mode/compact-mode state baked in), and a companion `attachGanttInteractivity(container, options)` call wires up hover tooltips and the time-mode/target-time/compact-mode controls client-side, via plain DOM event delegation rather than the shared `RenderBackend` traversal. See the [API Reference](/docs/reference/api/renderer) for the full `GanttRenderOptions`/`GanttInteractivityOptions` contract.

## Unified Traversal (`RenderBackend`)

Under the hood, the three document formatters (Markdown, HTML, Print HTML) delegate to a single orchestrator function (`renderRecipe` in `traversal.ts`) which invokes a `RenderBackend` implementation for each format. This guarantees structural parity across those output formats — a title, metadata block, shopping list, cookware section, instructions, footnotes, and nutrition panel are traversed in the exact same sequence regardless of whether you're targeting HTML, Markdown, or Print HTML. The Gantt chart renders a fundamentally different shape of output (a timeline, not a document) and doesn't go through this traversal.

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

`RendererOptions` also exposes `bakersReference`/`bakersMathOnly` (to display baker's-percentage math), `hideStepQty` (to omit ingredient quantities from inline step text across all formatters), and `renderId` (a prefix for footnote anchor ids, e.g. `"note-1"`; defaults to a fixed value, so override it with something unique — a recipe slug, for instance — when rendering multiple recipes on the same page, to avoid id collisions).

## Features

- **Fraction Formatting**: Converts decimals into readable fraction strings for common cooking amounts (e.g., `0.5` becomes `"1/2"`, `0.33` becomes `"1/3"`) for better readability in cooking contexts. These are plain text fractions (`1/2`), not single-glyph unicode characters.
- **Smart Escaping**: all three formatters escape user-generated recipe content (titles, ingredient names, step text, comments) before embedding it. `toHTML`/`toPrintHTML` escape HTML entities, so their output is safe to insert into a page as-is. `toMarkdown` specifically neutralizes `<` and `&` (encoded as the `&lt;`/`&amp;` entities, which render back as literal characters in any Markdown reader), so a raw tag like `<img src=x onerror=...>` in a title or ingredient name can't survive as executable HTML if you later render that Markdown to HTML.
  > [!WARNING]
  > This escaping neutralizes raw-HTML passthrough (the most common XSS vector with default Markdown renderers like `markdown-it`/`remark`), but `toMarkdown` doesn't do full Markdown sanitization — a `[text](javascript:...)` link, for instance, would still pass through unchanged. If you render `toMarkdown()`'s output to HTML from untrusted sources (e.g. imported/shared `.gram` files via `gram import`), still sanitize the final HTML (e.g. `rehype-sanitize`, DOMPurify) rather than assuming the output is fully safe.
- **Duration Formatting**: Converts raw minute integers into human-readable strings (e.g., `90` becomes `1h 30m`).
- **CSS Pre-styling**: The package ships a `gram.css` stylesheet with live-preview theming (light/dark tokens for each element type, e.g. ingredients, timers) and a `gantt.css` stylesheet for the Gantt chart (loaded alongside `gram.css`, never standalone — it reuses its `--color-*`/`--gray-*`/`--gram-font-*` tokens and dark-mode selector). The dedicated print stylesheet used for `toPrintHTML` is a separate, inlined stylesheet — you don't need to load any CSS file yourself to use print output.

## Direct JSON Consumption

If you are building a modern web app (e.g., using React, Vue, or Svelte), you **do not** have to use `@gram-lang/renderer`.

The JSON output from `@gram-lang/analyzer` is structured and can be iterated over directly — mapping over `recipe.sections` and `recipe.shopping_list` covers the common case. Keep in mind that richer recipes can produce more varied shapes worth handling explicitly, such as ingredient alternatives/groups, composite ingredients, or items carrying `normalizedMass`, `purchasingMass`, and `bakersPercentage` — `@gram-lang/renderer`'s own formatting logic is a good reference for how to handle these if you're building a custom consumer.
