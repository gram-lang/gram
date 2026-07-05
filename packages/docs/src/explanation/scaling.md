# Deep Dive: Scaling

Scaling a recipe sounds like a single multiplication, but Gram actually supports three distinct mechanisms that all end up producing one number — a **scale factor** — and then apply it consistently everywhere: the shopping list, every ingredient mention inside step text, and the recipe's `portions` metadata.

1. **Global Scaling** — a flat factor (`--scale 2`).
2. **Reverse Scaling** — a target quantity for one ingredient (`--scale flour=400g`), from which the factor is derived.
3. **Baker's Percentage** — not really "scaling" at all, but a *display* transform that shows every ingredient as a percentage of a reference ingredient's mass.

All three are resolved and applied through a small, centralized `ScaleEngine` in `@gram/kitchen`, rather than each consumer (CLI, Playground) re-deriving its own rules.

## Why a dedicated engine

Reverse scaling looks simple — divide the target quantity by the ingredient's current quantity — but a naive implementation gets a surprising number of things wrong silently:

- Scaling against `flour=1kg` when the recipe is written in `500g` computes a factor of `0.002` instead of `2` if you don't reconcile units first.
- Scaling against an ingredient marked fixed (`@=`, never scales) produces a factor that doesn't actually describe what happens to the recipe.
- Scaling against a relative quantity (`@water{70% @&flour}`) is circular: its value is *derived* from another ingredient, so it can't also be the reference.
- An ingredient split across two incompatible units in the same recipe only has a "primary" quantity in the aggregated shopping list — deriving a factor from it silently ignores the rest.

`resolveScaleFactor()` (exported from `@gram/kitchen`) validates all of this up front and throws a specific, typed error instead of returning a wrong number. Every consumer — the CLI's `--scale` flag today, the Playground tomorrow — calls the same function and gets the same guarantees for free.

## The request/resolution contract

```ts
type ScaleRequest =
  | { type: 'factor'; value: number }
  | { type: 'target'; id: string; qty: number; unit: string | null };

function resolveScaleFactor(
  compiled: CompilationResult | null,
  request: ScaleRequest,
  convertUnit?: (value: number, fromUnit: string, toUnit: string) => number | null,
): { factor: number; resolvedFrom: 'factor' | 'target'; targetId?: string; unitConverted?: boolean };
```

- **Factor mode** just validates the number is positive and finite — `compiled` isn't even needed, so callers can validate a raw factor (e.g. from a Playground slider) without running a pipeline.
- **Target mode** looks the ingredient up in `compiled.shopping_list`, runs it through the rejection rules below, reconciles units, and returns the derived factor.
- **`convertUnit`** is optional and injected by the caller. `@gram/kitchen` doesn't know about density or the `UNIT_CONVERSIONS` table — that lives in `@gram/analyzer` (it needs it anyway for mass standardization). The CLI wires `@gram/analyzer`'s `convertUnit` into the engine; without a converter, only exact unit matches (after alias normalization, e.g. "gram" → "g") succeed.

### Rejection rules (target mode)

| Error code | Why it's rejected | What the message suggests |
| :--- | :--- | :--- |
| `INGREDIENT_NOT_FOUND` | No ingredient with that id in the shopping list | A "did you mean" suggestion against the recipe's real ingredient ids |
| `NESTED_ONLY_TARGET` | Ingredient only exists inside a composite/sub-recipe's `usage[]`, never at top level | Scale the parent composite instead |
| `COMPOSITE_TARGET` | The id resolves to a composite (sub-recipe) batch total | That's an aggregate, not a scalable quantity |
| `ALTERNATIVE_TARGET` | The id is part of an alternative-ingredient group | Ambiguous which option you mean |
| `FIXED_INGREDIENT` | Marked `@=`, or a `TextQuantity` like "a pinch" (which is fixed by definition) | Never scales, so can't describe a scale factor either |
| `RELATIVE_TARGET` | Quantity is formula-derived (`70% @&flour`) | Scale the *target* ingredient (`flour`) instead — see [Relative Quantities](/reference/syntax/relative-quantities) |
| `AMBIGUOUS_MULTI_UNIT` | Same ingredient appears in two incompatible units across the recipe | The shopping list total can't be reduced to one number |
| `UNIT_MISMATCH` | Units belong to different physical families (mass vs. volume) with no density available | Add a density via `gram db enrich`, or match units |
| `INVALID_FACTOR` | Non-positive, non-finite, zero-quantity reference, etc. | — |

## Immutability

`applyScale(result, factor)` — the function that actually multiplies every quantity — is a pure function: it `structuredClone`s the input before mutating anything, and returns a new `CompilationResult`. Two things fall out of that for free:

- **No compounding.** Re-applying a different factor always starts from the same untouched original, so there's no risk of a factor being applied twice onto an already-scaled `portions` value.
- **No shared-reference corruption.** `compile()` itself defensively clones the AST's `meta` object before handing it to the result, so scaling a compiled recipe never mutates the parser's AST — safe even if a future caller (e.g. a Playground that caches the parsed AST and only recompiles on a scale-slider tick, instead of reparsing on every tick) reuses the same AST across multiple calls.

The resulting `CompilationResult` carries an honest `scaleFactor` field (default `1`) recording how it relates to the unscaled original — this is what interactive UIs (like the renderer's HTML portions widget) read to compute a baseline, instead of a hidden/underscored field.

## Baker's Percentage validation

Baker's Percentage isn't scaling, but it shares the same "don't compute a wrong number silently" philosophy. `@gram/analyzer` computes it as a `bakersPercentage` field per shopping-list item and per in-step ingredient mention — `@gram/renderer` just displays that precomputed value, it doesn't recompute it.

The reference ingredient (marked with `@*`, or forced via `--bakers-reference`) must be a physical anchor: if its own mass was itself derived from a relative quantity (`conversionMethod === 'relative'`), the analyzer refuses to use it as the 100% base — that would be circular — and instead emits an `INVALID_BAKERS_REFERENCE` warning on the result, leaving Baker's Math disabled for that run rather than showing percentages relative to a moving target.

If Baker's Math was requested (`--bakers-math` or `--bakers-reference`) but no `@*` modifier and no matching id were found at all, a `NO_BAKERS_REFERENCE` warning is emitted the same way — check `result.warnings` rather than a console log.

## Consuming this from a new frontend

1. Compile normally (`compile()`, optionally `analyze()` if you want mass/Baker's data).
2. Build a `ScaleRequest` from user input (a raw number, or an id + quantity + unit).
3. Call `resolveScaleFactor(compiled, request, convertUnit?)`. Catch `ScaleError` and switch on `.code` for UI-specific messaging — every error already carries a complete, user-facing `.message`.
4. Call `applyScale(compiled, resolution.factor)` to get the scaled result. Keep the original `compiled` around if you need to re-scale later (e.g. a live slider) — never re-scale an already-scaled result.
