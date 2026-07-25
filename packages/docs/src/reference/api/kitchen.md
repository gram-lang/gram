# @gram-lang/kitchen

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
  title: string | null;
  slug: string | null;
  meta: Meta;                        // parsed frontmatter
  scaleFactor?: number;               // present once any scaling has been applied
  registry: {
    ingredients: Record<string, RegistryEntry>;
    cookware: Record<string, { id: string; name: string }>;
  };
  shopping_list: (ShoppingListItem | CompositeItem | Usage)[];
  cookware: Usage[];
  sections: ProcessedSection[];
  warnings: Warning[];
  metrics: {
    preparationTime: number; // estimated mise-en-place time (minutes)
    cookTime: number;        // critical path duration (minutes)
    activeTime: number;      // sum of active cook work time (minutes)
    totalTime: number;       // preparationTime + cookTime
  };
}
```

See [Data Formats](/reference/api/data-formats) for a fully annotated example of this shape, and [Warnings](/reference/api/warnings) for what can appear in `.warnings`.

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

function calculatePreparationTime(sections: ProcessedSection[], registry: Registry): number
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

`CompilationResult.warnings` is a `Warning[]` — structural issues detected during compilation (undefined references, scope conflicts, invalid timer/temperature units, circular references...). See the [Warnings reference](/reference/api/warnings) for the full code list, severities, and `WarningCode`/`pushWarning` exports.
