# @gram-lang/renderer

Renders a `CompilationResult` or `AnalyzedCompilationResult` to Markdown, HTML, or a print-optimized standalone HTML document. If you're building a custom UI instead (React, Vue, Svelte), you likely don't need this package at all — consume the JSON directly, see [How to Build a Custom UI](/how-to/build-custom-ui).

## `toMarkdown` / `toHTML` / `toPrintHTML`

```typescript
function toMarkdown(data: CompilationResult | AnalyzedCompilationResult, options?: RendererOptions): string
function toHTML(data: CompilationResult | AnalyzedCompilationResult, options?: RendererOptions): string
function toPrintHTML(data: CompilationResult | AnalyzedCompilationResult, options?: RendererOptions): string
```

```typescript
import { compile } from '@gram-lang/kitchen';
import { toHTML } from '@gram-lang/renderer';

const compiled = compile(ast);
const html = toHTML(compiled, { lang: 'en' });
```

`toPrintHTML` returns a complete, self-contained HTML document (inline `<style>`, A4 `@page` rules, no external stylesheet dependency) suitable for "print this recipe" / PDF-export features — `toHTML` returns a bare fragment meant to be embedded into an existing page.

### `RendererOptions`

| Option | Type | Description |
|---|---|---|
| `icons` | `RendererIcons` | Override any subset of the default icon glyphs (see `DEFAULT_ICONS` below). |
| `classes` | `RendererClasses` | Override CSS class names on generated elements (HTML/print only). |
| `formatFraction` | `(value: number) => string` | Custom decimal → fraction formatter (default: common fractions like `0.5` → `"1/2"`). |
| `formatDuration` | `(minutes: number) => string` | Custom duration formatter (default: e.g. `90` → `"1h 30m"`). |
| `hideStepQty` | `boolean` | Omit ingredient quantities from inline step text (shopping list and mise-en-place are unaffected). |
| `bakersMathOnly` | `boolean` | Show only baker's percentages, hiding absolute quantities. |
| `interactiveScaling` | `boolean` | Render interactive portion/ingredient scaling controls (HTML only). |
| `lang` | `string` | Locale code (e.g. `'en'`, `'fr'`) for translating UI strings, via `@gram-lang/i18n`'s dictionaries. |
| `renderId` | `string` | Prefix for footnote anchor ids — override when rendering multiple recipes on one page to avoid id collisions. |

## Icons

```typescript
import { DEFAULT_ICONS, toHTML } from '@gram-lang/renderer';

const html = toHTML(compiled, {
  icons: { ...DEFAULT_ICONS.html, clock: '<svg class="my-clock-icon">...</svg>' },
});
```

`DEFAULT_ICONS` has two variants, `DEFAULT_ICONS.html` (Phosphor `<i>` tags) and `DEFAULT_ICONS.md` (emoji), each keyed by the same icon names as `RendererIcons`: `hourglass`, `timer`, `thermometer`, `caretRight`, `arrowRight`, `arrowUDownLeft`, `warning`, `pencilSimple`, `clock`, `fire`, `knife`, `scales`, `clockCounterClockwise`, `arrowElbowDownRight`, `info`, `minus`, `plus`.

## Formatting utilities

Lower-level helpers used internally by the three formatters, exported for building custom renderers on top of the same conventions:

```typescript
function formatDecimalToFraction(value: unknown): string   // 0.5 -> "1/2"
function getQty(item: Record<string, unknown>): { value: number | string | null; text?: string; isRelative?: boolean } | undefined
function formatQuantityValue(q: any): string                // Timer/Temperature quantity -> display string
function formatDuration(minutes: number): string            // 90 -> "1h 30m"
function escapeHtml(unsafe: string | null | undefined): string
```
