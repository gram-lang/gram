---
title: "@gram-lang/kitchen"
description: "The compiler: turns a parsed recipe into a structured JSON payload with shopping list, timings, and warnings."
---

The compiler. Takes a `RecipeAST` (from `@gram-lang/parser`) and produces a `CompilationResult`: a clean, structured, render-ready JSON payload — shopping list, per-section instructions with timings, a global ingredient/cookware registry, and any structural warnings. No ingredient database is involved at this stage; that's `@gram-lang/analyzer`'s job.

## `compile`

```typescript
function compile(ast: RecipeAST, options?: CompilerOptions): CompilationResult
```

```typescript
import { getAST } from '@gram-lang/parser';
import { compile } from '@gram-lang/kitchen';

const ast = getAST(source);
const compiled = compile(ast);
// compiled.shopping_list, compiled.sections, compiled.metrics, compiled.warnings, ...
```

Throws a plain `Error` for structural violations that can't be represented as a recoverable warning — e.g. more than one ingredient marked with the baker's-percentage (`*`) modifier.

### `CompilerOptions`

```typescript
interface CompilerOptions {
  scaleFactor?: number; // bakes a flat multiplier into the compiled output
}
```

### `CompilationResult`

```typescript
interface CompilationResult {
  generator: string;                 // "@gram-lang/kitchen@<version>": which compiler wrote this JSON
  title: string | null;
  slug: string | null;
  meta: Meta;                        // parsed frontmatter
  scaleFactor?: number;              // present once any scaling has been applied
  registry: {
    ingredients: Record<string, RegistryEntry>;
    cookware: Record<string, { id: string; name: string }>;
  };
  shopping_list: (ShoppingListItem | CompositeItem | Usage)[];
  cookware: Usage[];
  sections: ProcessedSection[];
  warnings: Warning[];
  metrics: {
    preparationTime: number;         // sum of miseEnPlace[].duration (minutes)
    activeTime: number;              // sum of active cook work time (minutes)
    // Deprecated since 1.4.0, removed in 2.0.0 (see below):
    totalTime: number;
    idleTime: number;
    activeBreakdown: TimeBreakdownItem[];
    prepBreakdown: TimeBreakdownItem[];
    totalBreakdown: TimeBreakdownItem[];
  };
  miseEnPlace: SectionMiseEnPlace[]; // what preparing each section costs
  schedules: { perSection: Schedule; upfront: Schedule };
}

interface SectionMiseEnPlace {
  section: number;                   // index into `sections`
  duration: number;                  // == sum of items[].duration
  items: MiseEnPlaceItem[];
}

type MiseEnPlaceItem =
  | { kind: "gather"; target: "ingredient" | "cookware"; count: number; duration: number }
  | { kind: "prepare"; ref: { type: "ingredient" | "cookware"; id: string }; duration: number };

interface Schedule {
  totalTime: number;                 // max(end) over blocks, from 0
  idleTime: number;                  // totalTime - metrics.activeTime - metrics.preparationTime
  blocks: ScheduleBlock[];           // sorted by start, then end
}

type ScheduleBlock =
  | { kind: "prep"; section: number; start: number; end: number }
  | { kind: "step"; section: number; step: number; start: number; end: number }
  | { kind: "passive"; section: number; step: number; track?: string; start: number; end: number };
```

:::note[New in 1.4.0: `generator`, `miseEnPlace` and `schedules`]
`miseEnPlace` says what preparing each section costs, and `schedules` holds two complete timelines built from it: `perSection` (each section's preparation right before that section) and `upfront` (all the preparation first). All times are in minutes from 0 and include the preparation. In a `step` or `passive` block, `step` is the index in `sections[section].steps`, comments included, and `track` only exists for a named timer (`~_oven{...}`). A section without a preparation has no `miseEnPlace` entry and no `prep` block.

Where a field comes from, so that you know what to trust and what to recompute:

| Field | Kind | Note |
|---|---|---|
| `generator`, `miseEnPlace[].items` | Source | Written by the compiler. |
| `miseEnPlace[].duration` | Derived | The sum of its `items`, kept so you don't have to add them up. |
| `metrics.preparationTime` | Derived | The sum of every `miseEnPlace[].duration`. |
| `schedules[mode].totalTime` | Derived | The latest `end` among the blocks. |
| `schedules[mode].idleTime` | Derived | `totalTime - metrics.activeTime - metrics.preparationTime`. |

Readers should ignore fields and block `kind` values they don't know: new ones can be added in a minor version.
:::

:::caution[Deprecated in 1.4.0, removed in 2.0.0]
These fields keep the same values and the same meaning until 2.0.0, but you should read their replacement:

| Deprecated | Use instead |
|---|---|
| `steps[].timings` | The `step` blocks of `schedules[mode].blocks` |
| `steps[].backgroundTasks` | The `passive` blocks of `schedules[mode].blocks` |
| `metrics.totalTime` | `schedules[mode].totalTime` |
| `metrics.idleTime` | `schedules[mode].idleTime` |
| `metrics.activeBreakdown`, `metrics.prepBreakdown`, `metrics.totalBreakdown` | `miseEnPlace` and `schedules` |
| `calculatePreparationTime().breakdown` | The `items` of `computeMiseEnPlace()` (`calculatePreparationTime()` still returns `total`) |

`metrics.preparationTime` and `metrics.activeTime` are **not** deprecated: they are the same in both schedules. Note that the old `metrics.totalTime` is the total of the `upfront` schedule.

The [Deprecated features](/docs/how-to/deprecations) page shows before and after code for each of them.
:::

:::note[JSON compiled before 1.4.0]
JSON written by kitchen 1.3.0 or earlier has no `schedules`. It still renders: `scheduleTimes` reads the total and idle time from the old `metrics.totalTime` and `metrics.idleTime`, and the diff compares them fairly instead of reading zero. There is no mise en place and no timeline to draw, though, so the Gantt chart stays empty. Compile the recipe again with 1.4.0 or later to get them. This fallback goes away with the deprecated fields in 2.0.0.
:::

See [Data Formats](/docs/reference/api/data-formats) for a fully annotated example of this shape, and [Warnings](/docs/reference/api/warnings) for what can appear in `.warnings`.

## Scaling

Recipes are compiled at their base quantities; scaling is a separate, composable step so callers (e.g. a live "servings" slider in a UI) can re-scale without re-parsing or re-compiling.

```typescript
function resolveScaleFactor(
  compiled: CompilationResult | null,
  request: ScaleRequest,
  convertUnit?: UnitConverter,
): ScaleResolution

function applyScale(result: CompilationResult, factor: number): CompilationResult
```

`ScaleRequest` is either a flat multiplier or a target quantity for a specific shopping-list ingredient, which `resolveScaleFactor` turns into a single `factor`:

```typescript
type ScaleRequest =
  | { type: "factor"; value: number }
  | { type: "target"; id: string; qty: number; unit: string | null };
```

```typescript
import { resolveScaleFactor, applyScale } from '@gram-lang/kitchen';

// "I want 300g of flour total" -> derives the multiplier from the compiled shopping list
const { factor } = resolveScaleFactor(compiled, { type: 'target', id: 'flour', qty: 300, unit: 'g' });
const scaled = applyScale(compiled, factor);
```

`resolveScaleFactor` throws a typed `ScaleError` subclass (each with a `.code`) when the request can't be satisfied: `InvalidFactorError` (thrown if scale factor is not positive finite, or if a scaled quantity overflows `Infinity`), `IngredientNotFoundError`, `NestedOnlyTargetError` (target only exists inside a composite sub-recipe), `AlternativeTargetError` (target is one option of an `@a|@b` group), `FixedIngredientError` (marked `@=` or non-numeric), `RelativeTargetError` (a `%`-derived quantity), `AmbiguousMultiUnitError` (used with incompatible units across the recipe), `NonNumericTargetError`, `UnitMismatchError`.

`applyScale` is pure — it never mutates its input, so the same `CompilationResult` can be re-scaled repeatedly (e.g. on every slider tick) without compounding. It satisfies the scaling parity invariant: `applyScale(compile(ast), factor) ≡ compile(ast, { scaleFactor: factor })`.

## Shopping list & timing (lower-level)

`compile()` already calls these internally; they're exported for advanced use (e.g. recomputing a shopping list from a custom-built `ProcessedSection[]`).

```typescript
function generateShoppingList(
  sections: ProcessedSection[],
  registry: Registry,
  options?: CompilerOptions,
): (ShoppingListItem | CompositeItem | Usage)[]

function calculatePreparationTime(
  sections: ProcessedSection[],
  registry: Registry,
  mise?: SectionMiseEnPlace[], // the split below, when you already have it
): { total: number; breakdown: TimeBreakdownItem[] } // `breakdown` is deprecated, see below

function computeMiseEnPlace(sections: ProcessedSection[], registry: Registry): SectionMiseEnPlace[]
// ^ the `miseEnPlace` field of a compiled recipe, derived from its sections

type ScheduleMode = "perSection" | "upfront"
const SCHEDULE_MODES: readonly ["perSection", "upfront"]
const DEFAULT_SCHEDULE_MODE: ScheduleMode // "perSection"
function isScheduleMode(value: unknown): value is ScheduleMode
function scheduleFor(compiled, mode?: ScheduleMode): Schedule | undefined
function scheduleTimes(compiled, mode?: ScheduleMode): { totalTime: number; idleTime: number }
```

## `RecipeRegistry`

The mutable ingredient/cookware registry built up during compilation, keyed by `slugify(name)`. Implements the `Registry` interface (`ingredients: Map`, `cookware: Map`, `warnings: Warning[]`).

```typescript
class RecipeRegistry implements Registry {
  registerIngredient(name: string, data?: Partial<Omit<RegistryEntry, "id" | "name">>): string; // returns id
  registerCookware(name: string): string;                                                        // returns id
  getIngredientId(name: string): string;
  toPlainObject(): { ingredients: Record<string, RegistryEntry>; cookware: Record<string, {...}> };
}
```

`RegistryEntry` carries `id`, `name`, and optionally `default_unit`, `is_composite`, `parent` (for composite sub-recipe children), and `is_intermediate`.

## Warnings

`CompilationResult.warnings` is a `Warning[]` — structural issues detected during compilation (undefined references, scope conflicts, invalid timer/temperature units, circular references...). See the [Warnings reference](/docs/reference/api/warnings) for the full code list, severities, and `WarningCode`/`pushWarning` exports.
