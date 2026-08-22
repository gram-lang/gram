# Conformance corpus

This is a language-implementation-agnostic set of golden tests for the Gram
pipeline (`.gram` source → AST → compiled JSON → analyzed JSON). Any
implementation — the current TypeScript one, or a future Rust one — must
reproduce these outputs byte-for-byte to be considered conformant.

The corpus exists in anticipation of a future migration of the pipeline to
Rust : by pinning down the TypeScript implementation's exact behavior now, as portable `input.gram` + golden-JSON pairs, a Rust port gets a ready-made conformance suite to check itself against instead of having to reverse-engineer expected behavior from the TypeScript source.

The runner in this directory (`run.ts`) is today's *reference* implementation of the checker, built on `@gram-lang/parser` / `@gram-lang/kitchen` /
`@gram-lang/analyzer`. The **cases themselves** (`cases/*/input.gram` +
their golden JSON files) are the portable artifact — a Rust implementation
would get its own checker that reads the same `input.gram` files and compares
against the same golden JSON.

## Directory layout

Each case is a directory under `cases/`:

```
cases/004-composite-ingredient/
  input.gram       # source recipe
  ast.json         # golden: getAST(input) output
  compiled.json    # golden: compile(ast, options?) output
  analyzed.json    # golden: analyze(compiled, database?, options?).result output
```

A case that is expected to throw (a parse error, or a scaling error — see
`options.json` below) has none of `ast.json` / `compiled.json` /
`analyzed.json` — instead it has only an `error.json`:

```
cases/err-001-invalid-composite-spacing/
  input.gram
  error.json        # { message, offset, expected, code } — see below
```

```json
{
  "message": "...",
  "offset": 12,
  "expected": "'<@' with no surrounding spaces",
  "code": null
}
```

`offset`/`expected` come from `GramParseError` (`@gram-lang/parser`), the
structured parse-error contract — see the "Résultats de l'audit" section of
the migration plan for why this replaced a plain `Error` with a prose-only
message. `code` comes from `ScaleError.code` (`@gram-lang/kitchen`, e.g.
`"NESTED_ONLY_TARGET"`) when a case throws during scale-target resolution
instead of during parsing; it's `null` for parse errors and any other thrown
error. Both fields are `null` when not applicable, always present, so every
`error.json` has an identical shape regardless of which pipeline stage threw.

Two further files are optional per case, read by the runner before the
pipeline runs, and absent from the 001-011 baseline cases (no file ⇒ today's
behavior: no options, empty database):

**`options.json`** — passed into `compile()`/`analyze()`:

```jsonc
{
  // Passed verbatim as compile()'s 2nd argument.
  "compilerOptions": { "scaleFactor": 2 },

  // Alternative to compilerOptions.scaleFactor: resolved via
  // resolveScaleFactor() against the unscaled compile() output, then a final
  // compile(ast, { scaleFactor: <resolved factor> }) call is made. Mutually
  // exclusive with compilerOptions.scaleFactor. A ScaleError thrown here
  // (e.g. targeting a fixed or nested-only ingredient) is captured the same
  // way a parse error is — see err-002 onward for examples.
  "scaleTarget": { "id": "flour", "qty": 500, "unit": "g" },

  // Passed verbatim as analyze()'s 3rd argument.
  "analyzerOptions": { "bakersReference": "flour" }
}
```

**`database.json`** — a flat, unwrapped `Record<string, IngredientData>`
(`@gram-lang/analyzer`'s `IngredientData` type: `name`, optional `physical`
(`density` required, `yield`/`unit_weight` optional), optional `nutrition`,
`aliases`, `tags`, `category`), passed as `analyze()`'s 2nd argument in place
of `{}`. It's deliberately plain JSON with no `{ ingredients: {...} }`
wrapper (unlike the CLI's YAML database format) — every other conformance
artifact is plain JSON, and this file only needs to round-trip through a
golden-test checker, not a human-authored YAML database. Validated via
`validateIngredientDatabase()`; a malformed entry throws at runner startup
rather than silently producing a wrong golden.

When neither file is present, `analyzed.json` reflects an **empty ingredient
database** (`{}`) and default options — the deterministic "no data available"
path (missing mass, no nutrition) that's common to every case not explicitly
exercising the database. Cases that need real mass/nutrition standardization
(mass conversion via density, yields, aliases, nutrition coverage) opt in via
`database.json` — see the `db-*` cases.

## Running

```sh
bun run conformance           # from repo root — verify all cases against goldens
bun run conformance:update    # (re)generate goldens from the current TS pipeline

# from this directory:
bun run run.ts                # same as above
bun run run.ts --update
bun run run.ts 004            # only run cases whose dirname contains "004"
```

The runner exits non-zero if any case doesn't match its golden(s), so it's
suitable for CI.

## Adding a case

1. Create `cases/<name>/input.gram` (and, if needed, `options.json` /
   `database.json` — see above), isolating **one** grammar/compiler/analyzer
   feature per case as much as possible — when a case fails, the directory
   name should already tell you roughly what broke. Name the directory
   according to what the case exercises:

   | Prefix | Use for | Example |
   |---|---|---|
   | `NNN-<description>` | an ordinary success case | `012-scale-factor-basic` |
   | `err-NNN-<description>` | anything expected to throw (parse error or `ScaleError`) | `err-002-scale-nested-only-target` |
   | `warn-NNN-<warning-code-kebab>` | one `WarningCode` per case, made deliberately reachable | `warn-003-circular-reference` |
   | `db-NNN-<description>` | a case whose point is its `database.json` (mass standardization, nutrition, aliases) | `db-001-mass-standardization-basic` |
   | `mod-NNN-<description>` | a case whose point is `@use` module resolution/composition (module-imports RFC) | `mod-001-basic-default-import` |

   A case may combine an `err-`/`warn-`/`db-`/`mod-` prefix with either
   optional file — e.g. `warn-011-no-bakers-reference` needs
   `options.json`, `warn-013-missing-macros` needs `database.json`.
   A `mod-*` case's `input.gram` may `@use` sibling `.gram` files placed
   anywhere inside that same case directory (e.g.
   `mod-001-basic-default-import/bases/pate.gram`) — resolved and URI'd
   relative to the case directory itself, never an absolute filesystem
   path, so goldens stay identical across machines.
2. Run `bun run conformance:update`.
3. **Read the generated JSON before committing it.** The runner will happily
   commit a bug's output as the new "golden" — nothing here checks that the
   output is *correct*, only that it's *stable*. If in doubt, cross-check
   against the manual assertions in `packages/parser/tests/grammar-edge-cases.test.ts`,
   `packages/kitchen/tests/scale.test.ts`, `packages/analyzer/tests/*.test.ts`,
   or the relevant package's own unit tests.
4. The runner decides success-vs-error mode per case by which golden(s)
   already exist on disk before an `--update` run: either the three success
   goldens, *or* `error.json` alone — never both. A case that throws partway
   through the pipeline (e.g. a valid parse followed by a scale-target error)
   still gets only `error.json`; no partial `ast.json`/`compiled.json` is left
   behind (see `runCase()` in `run.ts`).

## Case-directory conventions

- **`NNN-*`** — plain success cases exercising one parser/compiler/analyzer
  feature (e.g. `004-composite-ingredient`, `017-shopping-list-cross-section-aggregation`).
- **`err-NNN-*`** — anything expected to throw: parse errors (`GramParseError`,
  `err-001`) and scale-target errors (`ScaleError`, `err-002` onward), one
  `error.json` each, distinguished by `error.json`'s `code` field.
- **`warn-NNN-<warning-code-kebab>`** — one case per `WarningCode`
  (`packages/kitchen/src/warnings.ts`), each isolated to trigger *only* that
  code so a golden diff on one case points at exactly one warning path.
- **`db-NNN-*`** — cases whose `database.json` is the point: mass
  standardization (density, yield, unit_weight), nutrition (full/partial
  coverage), alias resolution, and cross-unit shopping-list aggregation with
  real ingredient data. Each case gets its own `database.json` rather than
  sharing one fixture across cases, so a case directory stays the fully
  portable, self-contained artifact this corpus is built around — editing one
  case's database can never silently reflow another case's golden.
- **`mod-NNN-*`** — cases whose point is `@use` module resolution/composition
  (`.notes/plan-ajout-imports-recettes.md`): `input.gram` imports one or more
  sibling `.gram` files inside the same case directory. `ast.json` still
  documents `getAST(input.gram)` alone (unresolved `imports`); `compiled.json`
  / `analyzed.json` reflect the fully composed, spliced document.
