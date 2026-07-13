# @gram-lang/analyzer

Enriches a `CompilationResult` (from `@gram-lang/kitchen`) with physical properties — standardized mass, purchasing yield, nutrition estimates, and baker's percentages — by cross-referencing an ingredient database. This is the only stage that needs a database; parsing and compilation work on any recipe with no external data.

## `analyze`

```typescript
function analyze(
  result: CompilationResult,
  database: Record<string, IngredientData>,
  options?: AnalyzerOptions,
): AnalysisResult

interface AnalysisResult {
  result: AnalyzedCompilationResult;
  missingIngredients: string[]; // ids present in the recipe but absent from `database`
}
```

```typescript
import { compile } from '@gram-lang/kitchen';
import { analyze } from '@gram-lang/analyzer';

const compiled = compile(ast);
const { result: analyzed, missingIngredients } = analyze(compiled, myIngredientDatabase);
```

> The ingredient database is the **second positional argument**, not a field on `options` — `analyze(compiled, database, options?)`.

`analyze()` is pure and never mutates `result`. `AnalyzedCompilationResult` extends `CompilationResult` — same shape, plus per-usage `normalizedMass`/`conversionMethod`/`isEstimate`/`purchasingMass`/`bakersPercentage` fields and a `metrics.nutrition` block. See [Data Formats](/reference/api/data-formats) for a fully annotated example.

### `AnalyzerOptions`

All flags default to enabled (`!== false` checks internally) — pass `false` to opt out of a given enrichment pass.

| Option | Type | Description |
|---|---|---|
| `enableMassStandardization` | `boolean` | Convert ingredient quantities into standardized grams. |
| `enableYieldCalculation` | `boolean` | Apply the ingredient database's `physical.yield` (waste factor) when standardizing mass. |
| `enableNutritionalEstimation` | `boolean` | Compute `metrics.nutrition` (calories, macros, optionally per-portion). |
| `enableBakersMath` | `boolean` | Compute `bakersPercentage` relative to the `*`-marked (or `bakersReference`) ingredient. |
| `bakersReference` | `string` | Explicit ingredient id to use as the 100% baker's-percentage base, instead of the `*` modifier. |
| `portions` | `number` | Portion count used to compute `metrics.nutrition.perPortion`. |

## `validateIngredientDatabase`

```typescript
function validateIngredientDatabase(rawDb: unknown): {
  data: Record<string, IngredientData>;
  rejected: { key: string; message: string }[];
}
```

Validates entry-by-entry rather than all-or-nothing: one malformed ingredient doesn't prevent every other valid one from loading. Use `data` to compile/analyze; surface `rejected` to the user (e.g. `gram db validate`). See [Data Formats](/reference/api/data-formats) for the `IngredientData` YAML schema.

## Mass utilities

```typescript
function standardizeMass(
  amount: number,
  unit: string,
  database: Record<string, IngredientData>,
  ingredientName?: string,
  overrides?: Record<string, number>, // slug -> density (g/mL) or unit weight (g), from frontmatter `densities:`
): { mass: number; method: "physical" | "density" | "unit_weight" | "default" | "explicit"; isEstimate: boolean } | null

function convertUnit(value: number, fromUnit: string, toUnit: string, density?: number): number | null

function applyYield(
  mass: number,
  method: "physical" | "density" | "unit_weight" | "default" | "explicit",
  yieldFactor?: number,
): { normalizedMass: number; purchasingMass?: number }
```

`standardizeMass` resolves a quantity to grams via, in order: (1) a direct mass unit (`g`, `kg`, `oz`...), (2) a volume unit converted through the ingredient's resolved density, (3) an unrecognized unit (`clove`, `slice`...) treated as a count via the ingredient's `unit_weight`. Returns `null` — never guesses — when a volume unit has no resolvable density.

`convertUnit` converts between two arbitrary unit strings, bridging mass↔volume families via `density` (g/mL) when given. Returns `null` for an unresolvable cross-family conversion without one.

### Mass & volume conversion table

The base conversion factors `standardizeMass`/`convertUnit` use for same-family (mass↔mass, volume↔volume) conversions, before any density is involved:

<!--@include: ./parts/en/unit-conversions.md-->

## `calculateNutrition`

```typescript
function calculateNutrition(
  ingredients: AnalyzedUsage[],
  database: Record<string, IngredientData>,
  portions?: number,
): NutritionMetrics
```

Flattens composites and alternatives (taking the first option), skips `optional`-modifier and zero-quantity ingredients, and sums `nutrition` fields (declared **per 100g** in the database — see [Data Formats](/reference/api/data-formats)) scaled by each ingredient's standardized mass. Returns `isEstimate: true` if any contributing mass was itself an estimate, and `coverage` (0–1: fraction of ingredients with known nutrition data).

## `diffRecipes`

```typescript
function diffRecipes(a: CompilationResult, b: CompilationResult): DiffResult
```

Structural diff between two compiled recipes (e.g. two versions of the same file, or a scaled vs. unscaled result) — ingredient quantity/unit changes (with `percentChange` when comparable), preparation changes, timing deltas, added/removed/changed sections, temperature and timer changes, and frontmatter (`meta`) changes. `hasChanges` is `true` if any category is non-empty.
