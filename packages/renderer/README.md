# @gram-lang/renderer

[![npm version](https://badge.fury.io/js/@gram-lang%2Frenderer.svg)](https://www.npmjs.com/package/@gram-lang/renderer)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

*Part of the [Gram monorepo](https://git.gram-lang.org/gram-lang/gram).*

The universal renderer for the Gram recipe language. It takes compiled or analyzed recipe ASTs and renders them into structured Markdown or semantic HTML with support for custom visual elements and class names.

---

## 📚 General Documentation

For full syntax specifications, grammar details, cheatsheets, and best practices, please refer to the **[Gram Documentation](https://docs.gram-lang.org/)**.

---

## 🛠️ Installation

```bash
npm install @gram-lang/renderer
# or
bun add @gram-lang/renderer
```

---

## ⚡ Usage

```typescript
import {
  toMarkdown,
  toHTML,
  toPrintHTML,
  toGanttHTML,
  attachGanttInteractivity
} from '@gram-lang/renderer';

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

// 3. Print-optimized HTML rendering (self-contained, single-page layout)
const printHtml = toPrintHTML(recipe);

// 4. Gantt Chart timeline rendering (HTML fragment + client-side interactivity)
const ganttHtml = toGanttHTML(recipe, { lang: 'en' });
const container = document.getElementById('gantt-container');
container.innerHTML = ganttHtml;

const handle = attachGanttInteractivity(container, {
  timeMode: 'forward',   // 'forward' (T+), 'reverse' (T-), or 'target'
  targetTime: '19:30',   // Target serve time when timeMode is 'target'
  isCompactMode: false   // Toggle compact row height
});
```

---

## 🏗️ Structure

*   `src/index.ts`: The main entry point exporting public APIs.
*   `src/types.ts`: TypeScript interfaces for `RendererOptions`, `RendererIcons`, and `RendererClasses`.
*   `src/utils.ts`: Common helpers (decimal-to-fraction formatting, HTML escaping, duration formatting).
*   `src/gantt/`: Gantt chart layout computation, HTML fragment rendering, and event delegation interactivity (`layout.ts`, `render.ts`, `interactivity.ts`, `types.ts`).
*   `src/formatters/element.ts`: Universal formatter for individual AST nodes (ingredients, cookware, timers, alternative groups).
*   `src/formatters/markdown.ts`: Orchestrates Markdown generation for full recipes.
*   `src/formatters/html.ts`: Orchestrates HTML generation for full recipes using classes and icons injection.
*   `src/formatters/print.ts`: Orchestrates self-contained, print-optimized HTML generation (`toPrintHTML`).
*   `gantt.css`: Stylesheet for the Gantt chart timeline component.

---

## 📄 License

This project is licensed under the GPL-3.0 License.
