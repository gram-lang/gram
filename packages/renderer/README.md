# @gram-lang/renderer

The universal renderer for the Gram recipe language. It takes compiled or analyzed recipe ASTs and renders them into structured Markdown or semantic HTML with support for custom visual elements and class names.

---

## 📚 General Documentation

For full syntax specifications, grammar details, cheatsheets, and best practices, please refer to the central **[Gram Documentation Index](../../docs/README.md)**.

---

## 🛠️ Installation

Install `@gram-lang/renderer` via bun:

```bash
bun install @gram-lang/renderer
```

---

## ⚡ Usage

```typescript
import { toMarkdown, toHTML } from '@gram-lang/renderer';

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
    clock: '<span class="icon-clock">🕒</span>',
    fire: '<span class="icon-fire">🔥</span>'
  },
  classes: {
    recipeTitle: "custom-title",
    recipeMeta: "flex gap-2"
  }
});
```

---

## 🏗️ Structure

*   `src/index.ts`: The main entry point exporting public APIs.
*   `src/types.ts`: TypeScript interfaces for `RendererOptions`, `RendererIcons`, and `RendererClasses`.
*   `src/utils.ts`: Common helpers (decimal-to-fraction formatting, HTML escaping, duration formatting).
*   `src/formatters/element.ts`: Universal formatter for individual AST nodes (ingredients, cookware, timers, alternative groups).
*   `src/formatters/markdown.ts`: Orchestrates Markdown generation for full recipes.
*   `src/formatters/html.ts`: Orchestrates HTML generation for full recipes using classes and icons injection.

---

## 📄 License

This project is licensed under the GPL-3.0 License.
