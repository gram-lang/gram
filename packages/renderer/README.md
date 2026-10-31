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
  runSheetToText,
  runSheetToHTML
} from '@gram-lang/renderer';
import { project, runSheet } from '@gram-lang/scheduler';

const recipe = {
  title: "Simple Crepes",
  metrics: { activeTime: 10 },
  // The timelines a compiled recipe carries, one per mode (`perSection`,
  // `upfront`, `perDay`; `compile()` produces them for you): only the one
  // you render is read. `metrics.totalTime` is deprecated: it is only read when
  // `schedules` is missing.
  schedules: {
    perSection: { totalTime: 30, idleTime: 20, blocks: [], days: [] }
  },
  shopping_list: [
    { id: "flour", qty: 200, unit: "g" }
  ],
  sections: [
    {
      title: "Preparation",
      steps: [
        { type: "step", content: ["Whisk everything together."] }
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

// 4. The work plan of a schedule: the days, the visits to the kitchen, what to take out.
// `runSheet()` (from @gram-lang/scheduler) computes it; the renderer writes it.
const context = {
  serveAt: '2026-10-17T20:00',
  timeZone: 'Europe/Paris',
  availability: { daily: [{ start: '08:00', end: '22:00' }] }
};
const sheet = runSheet(project([{ graph: recipe.tasks }], context), { graph: recipe.tasks, context });
const text = runSheetToText(sheet, recipe, { lang: 'en' });  // plain text
const fragment = runSheetToHTML(sheet, recipe);              // HTML fragment, no script

// 5. Or write it after the recipe, in one document
const document = toHTML(recipe, { runSheet: sheet });
```

---

## 🏗️ Structure

*   `src/index.ts`: The main entry point exporting public APIs.
*   `src/types.ts`: TypeScript interfaces for `RendererOptions`, `RendererIcons`, and `RendererClasses`.
*   `src/utils.ts`: Common helpers (decimal-to-fraction formatting, HTML escaping, duration formatting).
*   `src/run-sheet.ts`, `src/work-plan-parts.ts`, `src/serve-times.ts`: The work plan in words (`describeRunSheet`, `runSheetTo*`), what to take out and what to do (`visitKit`, `sectionProgram`), and the serving time search in words.
*   `src/gantt/`: The deprecated Gantt chart (removed in 2.0.0): layout computation, HTML fragment rendering, and event delegation interactivity.
*   `src/formatters/element.ts`: Universal formatter for individual AST nodes (ingredients, cookware, timers, alternative groups).
*   `src/formatters/markdown.ts`: Orchestrates Markdown generation for full recipes.
*   `src/formatters/html.ts`: Orchestrates HTML generation for full recipes using classes and icons injection.
*   `src/formatters/print.ts`: Orchestrates self-contained, print-optimized HTML generation (`toPrintHTML`).
*   `gram.css`: Stylesheet of the recipe and the work plan.
*   `gantt.css`: Stylesheet of the deprecated Gantt chart.

---

## 📄 License

This project is licensed under the GPL-3.0 License.
