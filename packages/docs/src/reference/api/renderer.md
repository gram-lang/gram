# @gram-lang/renderer

Renders a `CompilationResult` or `AnalyzedCompilationResult` to Markdown, HTML, or a print-optimized standalone HTML document. If you're building a custom UI instead (React, Vue, Svelte), you likely don't need this package at all — consume the JSON directly, see [How to Build a Custom UI](/how-to/build-custom-ui).

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
| `hideStepQty` | `boolean` | Omit ingredient quantities from inline step text across all formatters (shopping list and mise-en-place are unaffected). |
| `bakersMathOnly` | `boolean` | Show only baker's percentages, hiding absolute quantities. |
| `interactiveScaling` | `boolean` | Render interactive portion/ingredient scaling controls (HTML only). |
| `lang` | `string` | Locale code (e.g. `'en'`, `'fr'`) for translating UI strings, via `@gram-lang/i18n`'s dictionaries. |
| `renderId` | `string` | Prefix for footnote anchor ids — override when rendering multiple recipes on one page to avoid id collisions. |

## Gantt Chart (`toGanttHTML` & `attachGanttInteractivity`)

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
| `gapThresholdMinutes` | `number` | Minimum idle gap duration in minutes before gap compression is applied (default: `60`). |
| `compressedGapSize` | `number` | Virtual minute width that compressed idle gaps collapse down to (default: `20`). |

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

`DEFAULT_ICONS` has two variants, `DEFAULT_ICONS.html` (Phosphor `<i>` tags) and `DEFAULT_ICONS.md` (emoji), each keyed by a subset of `RendererIcons`: `hourglass`, `timer`, `thermometer`, `caretRight`, `arrowRight`, `arrowUDownLeft`, `warning`, `pencilSimple`, `minus`, `plus`. The remaining `RendererIcons` fields (`clock`, `fire`, `knife`, `scales`, `clockCounterClockwise`, `arrowElbowDownRight`, `info`) aren't part of `DEFAULT_ICONS` — `toHTML` falls back to its own hardcoded Phosphor markup for those when `options.icons` doesn't override them, so overriding one of these seven only has an effect when passed directly via `options.icons`, not via a spread of `DEFAULT_ICONS`.

## Formatting utilities

Lower-level helpers used internally by the three formatters, exported for building custom renderers on top of the same conventions:

```typescript
function formatDecimalToFraction(value: unknown): string   // 0.5 -> "1/2"
function getQty(item: Record<string, unknown>): { value: number | string | null; text?: string; isRelative?: boolean } | undefined
function formatQuantityValue(q: any): string                // Timer/Temperature quantity -> display string
function formatDuration(minutes: number): string            // 90 -> "1h 30m"
function escapeHtml(unsafe: string | null | undefined): string
function escapeMarkdownHtml(unsafe: string | null | undefined): string   // neutralizes `<`/`&` for safe Markdown-to-HTML rendering downstream
function joinStepTokens(tokens: StepToken[], renderToken: (token: StepToken) => string, isSpaceable: (token: StepToken) => boolean): string
```
