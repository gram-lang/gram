# @gram-lang/renderer

[![npm version](https://badge.fury.io/js/@gram-lang%2Frenderer.svg)](https://www.npmjs.com/package/@gram-lang/renderer)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

*Part of the [Gram monorepo](https://git.gram-lang.org/gram-lang/gram).*

The renderer of the Gram recipe language. It turns a compiled (or analyzed) recipe into **views**, the recipe and its run sheet, each written in every format it offers: semantic HTML, Markdown, plain text and a print layout. The views follow a list of settings (comments, mise en place, rests, quantities in the steps, nutrition basis...) that the CLI, the editor and the playground read from the same place. The engine computes, the views only show.

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
import { getAST } from '@gram-lang/parser';
import { compile } from '@gram-lang/kitchen';
import { analyze } from '@gram-lang/analyzer';
import {
  toHTML,
  toMarkdown,
  toText,
  toPrintHTML,
  prepareViews,
  render,
  views
} from '@gram-lang/renderer';

const { result: recipe } = analyze(compile(getAST(source)), ingredientDatabase);

// 1. The recipe in each of its formats
const html = toHTML(recipe, { lang: 'en' });       // semantic HTML, styled by gram.css
const markdown = toMarkdown(recipe);
const text = toText(recipe, { lang: 'en' });       // plain text, for a terminal or a file
const printHtml = toPrintHTML(recipe);             // self-contained, one page per day

// 2. Customized HTML (inversion of control)
const custom = toHTML(recipe, {
  icons: { clock: '<span class="icon-clock">🕒</span>' },
  classes: { recipeTitle: 'custom-title' }
});

// 3. Views: the same pipeline for every view, worked out once
//    `prepareViews()` computes the timeline, the run sheet and the serving time
//    search only when a view asks for them.
const input = prepareViews(
  recipe,
  { miseEnPlace: 'perSection', rests: 'shortest', comments: 'show' },   // the view settings
  {
    lang: 'en',
    serveAt: '2026-10-17T20:00',                                        // optional: put the plan on the calendar
    kitchen: { timeZone: 'Europe/Paris', availability: { daily: [{ start: '08:00', end: '22:00' }] } }
  }
);

for (const view of views) {
  // `views` lists each view with its formats; `render()` returns null when the recipe has nothing for it
  console.log(view.id, view.formats);                     // 'recipe' [...], 'runSheet' [...]
}
const runSheetHtml = render('runSheet', input, 'html');   // HTML fragment, no script
const runSheetText = render('runSheet', input, 'text');
```

The settings are described once in `VIEW_SETTINGS` and `RECIPE_SETTINGS` (values, defaults, descriptions), read with `parseViewSettings()` and `parseRecipeSettings()`. `inspectors` and `outputs` list the looks at the pipeline (composed AST, compiled JSON, JSON tree) next to the views, for an interface that offers both.

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) to add a view or a setting.

---

## 🏗️ Structure

*   `src/index.ts`: The main entry point exporting public APIs.
*   `src/prepare-views.ts`: `prepareViews()`, the one entry point of the views: the timeline, the run sheet and the serving time search, worked out once and only when a view reads them.
*   `src/contract.ts`: What a view (`ViewDefinition`) and an inspector are, and the formats.
*   `src/views/registry.ts`, `src/outputs.ts`: The list of views (`views`, `render()`) and of every output (views and inspectors).
*   `src/views/recipe/`: The recipe view: HTML, Markdown, plain text and print, its `screen.css` and `print.css`.
*   `src/views/run-sheet/`: The run sheet view (`runSheetTo*`, `describeRunSheet`): the days, the visits to the kitchen, what to take out and what to do, and the serving time search in words.
*   `src/inspectors/`: The AST as an S-expression and the JSON tree (`renderSExpr`, `renderJsonTree`).
*   `src/settings.ts`: The descriptors of the view and recipe settings, shared by every surface.
*   `src/shared/`: What several views use (formatting of a step, nutrition, icons, tooltips, `tokens.css`, `base.css` and the base print stylesheet).
*   `src/describe-error.ts`: `describeError()`, the same error report for every interface.
*   `src/types.ts`: TypeScript interfaces for `RendererOptions`, `RendererIcons`, and `RendererClasses`.
*   `src/gantt/`: The deprecated Gantt chart (removed in 2.0.0), no longer drawn by any Gram surface: use the run sheet.
*   `gram.css` (`@gram-lang/renderer/gram.css`, built into `dist/`): The stylesheet of every view on screen, each view scoped to its own root element (`.gram-recipe`, `.gram-run-sheet`) with the CSS `@scope` rule.
*   `gantt.css`: Stylesheet of the deprecated Gantt chart.

---

## 📄 License

This project is licensed under the GPL-3.0 License.
