---
title: "@gram-lang/renderer"
description: "Render compiled recipes to Markdown, HTML, print-ready documents, or an interactive Gantt timeline."
---

Renders a `CompilationResult` or `AnalyzedCompilationResult` to Markdown, HTML, or a print-optimized standalone HTML document. If you're building a custom UI instead (React, Vue, Svelte), you likely don't need this package at all — consume the JSON directly, see [How to Build a Custom UI](/docs/how-to/build-custom-ui).

## `toMarkdown` / `toHTML` / `toPrintHTML`

```typescript
type RenderableCompilationResult = CompilationResult | AnalyzedCompilationResult;

function toMarkdown(data: RenderableCompilationResult, options?: RendererOptions): string
function toHTML(data: RenderableCompilationResult, options?: RendererOptions): string
function toPrintHTML(data: RenderableCompilationResult, options?: RendererOptions): string
```

```typescript
import { compile } from '@gram-lang/kitchen';
import { toHTML } from '@gram-lang/renderer';

const compiled = compile(ast);
const html = toHTML(compiled, { lang: 'en' });
```

`toPrintHTML` returns a complete, self-contained HTML document (inline `<style>`, A4 `@page` rules, no external stylesheet dependency) suitable for "print this recipe" / PDF-export features — `toHTML` returns a bare fragment meant to be embedded into an existing page.

All three formatters share a single traversal architecture (`RenderBackend`), ensuring features like nutrition summaries, footnotes, gross mass badges, and mixed-unit warnings render consistently across Markdown, HTML, and Print output.

### `RendererOptions`

| Option | Type | Description |
|---|---|---|
| `icons` | `RendererIcons` | Override any subset of the default icon glyphs (see `DEFAULT_ICONS` below). |
| `classes` | `RendererClasses` | Override CSS class names on generated elements (HTML/print only). |
| `formatFraction` | `(value: number) => string` | Custom decimal → fraction formatter (default: common fractions like `0.5` → `"1/2"`). |
| `formatDuration` | `(minutes: number) => string` | Custom duration formatter (default: e.g. `90` → `"1h 30m"`). |
| `hideStepQty` | `boolean` | Omit ingredient quantities from inline step text across all formatters (the shopping list and each section's ingredient list are unaffected). |
| `miseEnPlace` | `'perSection' \| 'upfront' \| 'perSession'` | *(Since 1.4.0)* Where the mise en place goes: right before each section (`'perSection'`, the default), all at the start (`'upfront'`) or at the start of each working day (`'perSession'`). Drives the total and idle times in the header. With `'perSection'`, HTML shows a "Mise en place" label on each section's ingredient list (the duration and detail show on hover). With the other two, HTML, Markdown and print open each session with one "Mise en place" block (labelled `D-3`, `D-1`, `Day D`... when the recipe spans several days), and HTML keeps a label on a section only for what has to wait, an intermediate made the same day. Ingredient lists are the same in all three. The timeline is laid out from the recipe's `tasks`. |
| `rests` | `'shortest' \| 'balanced' \| 'longest'` | *(Since 1.4.0)* How long a rest written as a range (`~_{12-24h}`) lasts: the shortest (the default), the middle or the longest. An exact rest and an active timer are not affected. Drives the same times as `miseEnPlace`. |
| `projection` | `ProjectedPlan` | *(Since 1.4.0)* The recipe placed on the calendar by `project()` from `@gram-lang/scheduler`. The recipe then says when each step happens: when it is served and what could not be fixed at the top of the instructions, a time next to every step ("around 21:40"), the day between steps when it changes (`D-1`, `Day D`), and what a step leaves resting, with the note of a rest the plan stretched or shortened. The total and idle times in the header are those of the plan. The words and the rounding are those of the production sheet; `lang` picks the language. Without it, the recipe reads as it always did. |
| `runSheet` | `boolean` | *(Since 1.4.0)* With a `projection`: also write the production sheet after the recipe, the two in one document (Markdown: one heading level down; print: with its own styles). The recipe and the sheet say the same things in two orders, the sections and the time. |
| `bakersMathOnly` | `boolean` | Show only baker's percentages, hiding absolute quantities. |
| `interactiveScaling` | `boolean` | Render interactive portion/ingredient scaling controls (HTML only). |
| `nutritionBasis` | `'auto' \| 'total' \| 'perPortion' \| 'per100g'` | Which nutrition basis to display. `'auto'` (the default) shows per-portion when the recipe declares a portion count, otherwise the whole recipe. |
| `interactiveNutrition` | `boolean` | HTML only: emit every available nutrition basis behind a CSS-only reader toggle instead of a single one. Requires the renderer stylesheet; ignored when `nutritionBasis` pins a basis. |
| `lang` | `string` | Locale code (e.g. `'en'`, `'fr'`) for translating UI strings, via `@gram-lang/i18n`'s dictionaries. |
| `renderId` | `string` | Prefix for footnote anchor ids — override when rendering multiple recipes on one page to avoid id collisions. |

## Gantt chart (`toGanttHTML` & `attachGanttInteractivity`)

Renders a compiled/analyzed recipe into an interactive timeline view, offering a precise visual and temporal representation of preparation steps, active tasks, and background timers.

```typescript
import { toGanttHTML, attachGanttInteractivity } from '@gram-lang/renderer';

// 1. Generate the static HTML fragment
const ganttHtml = toGanttHTML(compiled, { lang: 'en' });
container.innerHTML = ganttHtml;

// 2. Attach interactive controls and hover tooltips
const handle = attachGanttInteractivity(container, {
  timeMode: 'forward',   // 'forward' (T+ stopwatch), 'reverse' (T- countdown), or 'target' (target time)
  targetTime: '19:30',   // Target serve time (HH:MM)
  isCompactMode: false   // Toggle compact row height
});

// Update or query options dynamically
handle.setOptions({ isCompactMode: true });

// Clean up event listeners on unmount
handle.dispose();
```

### `GanttRenderOptions`

| Option | Type | Description |
|---|---|---|
| `lang` | `string` | Locale code (e.g. `'en'`, `'fr'`) for UI translations via `@gram-lang/i18n`. |
| `gapThresholdMinutes` | `number` | Minimum idle gap duration in minutes before gap compression is applied (default: `60`). `Infinity` never compresses. |
| `compressedGapSize` | `number` | Virtual minute width that compressed idle gaps collapse down to (default: `20`); never wider than the gap itself. |
| `miseEnPlace` | `'perSection' \| 'upfront' \| 'perSession'` | *(Since 1.4.0)* Where the mise en place goes (default: `'perSection'`). Each section's mise en place is a dashed block in the section's colour, right before the section, all at the start or at the start of its working day; with `'perSession'` a marker labels each day. The timeline is laid out from the recipe's `tasks`. |
| `rests` | `'shortest' \| 'balanced' \| 'longest'` | *(Since 1.4.0)* How long a rest written as a range lasts (default: `'shortest'`). |
| `projection` | `ProjectedPlan` | *(Since 1.4.0)* The recipe placed on the calendar by `project()` from `@gram-lang/scheduler`. The chart draws the plan's own blocks (a rest that was stretched or shortened shows at its new length, outlined, with a note), reads its axis in real days and times of the plan's time zone, greys out the hours the cook is not available, and leaves out the time-mode selector. `miseEnPlace` and `rests` are then those the plan was made with, and are ignored here. |

### `GanttInteractivityOptions`

| Option | Type | Description |
|---|---|---|
| `timeMode` | `'forward' \| 'reverse' \| 'target'` | Timeline tick display mode: elapsed time (T+), countdown (T-), or clock time based on serve target. |
| `targetTime` | `string` | Target serve time formatted as `"HH:MM"`. |
| `isCompactMode` | `boolean` | Toggles compact view mode for tight vertical space. |

## Icons

```typescript
import { DEFAULT_ICONS, toHTML } from '@gram-lang/renderer';

const html = toHTML(compiled, {
  icons: { ...DEFAULT_ICONS.html, clock: '<svg class="my-clock-icon">...</svg>' },
});
```

`DEFAULT_ICONS` has two variants: `DEFAULT_ICONS.html` (self-contained Phosphor inline `<svg>` elements) and `DEFAULT_ICONS.md` (emoji), each covering the full set of `RendererIcons` fields (`hourglass`, `timer`, `thermometer`, `caretRight`, `arrowRight`, `arrowUDownLeft`, `arrowElbowDownRight`, `warning`, `pencilSimple`, `minus`, `plus`, `clock`, `clockCounterClockwise`, `fire`, `knife`, `scales`, `package`, `info`). Any icon can be overridden individually via `options.icons`.

## Formatting utilities

Lower-level helpers used internally by the three formatters, exported for building custom renderers on top of the same conventions:

```typescript
function formatDecimalToFraction(value: unknown): string   // 0.5 -> "1/2"
function getQty(item: Record<string, unknown>): { value: number | string | null; text?: string; isRelative?: boolean } | undefined
function formatQuantityValue(q: any): string                // Timer/Temperature quantity -> display string
function formatDuration(minutes: number): string            // 90 -> "1h 30m"; rounded to the minute from 1h up, to the second below (64.5 -> "1h 5m", 0.33 -> "20s")
function formatTimer(item: { quantity?: unknown; unit?: string | null }, separator?: string): string   // { quantity: 1, unit: "h" } -> "1h"
function toCommonFraction(value: number): string | undefined   // 0.25 -> "1/4", 0.3 -> undefined
function escapeHtml(unsafe: string | null | undefined): string
function escapeMarkdownHtml(unsafe: string | null | undefined): string   // neutralizes `<`/`&` for safe Markdown-to-HTML rendering downstream
function joinStepTokens(tokens: StepToken[], renderToken: (token: StepToken) => string, isSpaceable: (token: StepToken) => boolean): string
```

## Production sheet

*(Since 1.4.0)* From the plan made by `project()` and the compiled recipe it was made from, the renderer writes the production sheet in four formats, plus the sheet in words for building your own:

```typescript
import { project, runSheet } from '@gram-lang/scheduler';
import { runSheetToText, runSheetToMarkdown, runSheetToHTML, runSheetToPrintHTML, describeRunSheet } from '@gram-lang/renderer';

const sheet = runSheet(project([{ graph: compiled.tasks }], context));

runSheetToText(sheet, compiled, { lang: 'en' });      // plain text
runSheetToMarkdown(sheet, compiled, { lang: 'en' });  // Markdown
runSheetToHTML(sheet, compiled, { lang: 'en' });      // a fragment, styled by gram.css
runSheetToPrintHTML(sheet, compiled, { lang: 'en' }); // a complete, print-ready document
const model = describeRunSheet(sheet, compiled);       // { title, servedAt, days: [{ heading, lines }], problems }
```

### `RunSheetRenderOptions`

| Option | Type | Description |
|---|---|---|
| `lang` | `string` | Locale code (`'en'`, `'fr'`) for the words and the dates. |
| `roundTo` | `number` | Display only: a time is shown to the nearest this many minutes (default: `5`). The calculation stays exact to the minute. |
| `formatDuration` | `(minutes: number) => string` | Custom duration formatter. |

Each line says when the task starts ("around 21:40"), what it is, how long it lasts and, for a rest, until when. A step with no hands-on time of its own is left out: the rest it starts carries what it says. Every rest the plan moved has a note, and what could not be fixed is listed at the end. Everything that comes from the recipe is escaped. The sheet covers the first recipe of the plan.
