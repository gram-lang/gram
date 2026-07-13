# Conformance corpus

This is the Phase 0 deliverable of the [Rust migration plan](../RUST_MIGRATION_PLAN.md):
a language-implementation-agnostic set of golden tests for the Gram pipeline
(`.gram` source → AST → compiled JSON → analyzed JSON). Any implementation —
the current TypeScript one, or a future Rust one — must reproduce these
outputs byte-for-byte to be considered conformant.

The runner in this directory (`run.ts`) is today's *reference* implementation
of the checker, built on `@gram-lang/parser` / `@gram-lang/kitchen` /
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
  compiled.json    # golden: compile(ast) output
  analyzed.json    # golden: analyze(compiled, {}).result output (empty ingredient DB)
```

A case that is expected to fail parsing has no `ast.json` / `compiled.json` /
`analyzed.json` — instead it has an `error.json`:

```
cases/err-001-invalid-composite-spacing/
  input.gram
  error.json        # { message, offset, expected } — see GramParseError
```

`error.json`'s `offset`/`expected` fields come from `GramParseError`
(`@gram-lang/parser`), the structured parse-error contract — see the "Résultats
de l'audit" section of the migration plan for why this replaced a plain
`Error` with a prose-only message.

The `analyzed.json` golden always uses an **empty ingredient database** (`{}`).
This exercises the deterministic "no data available" path (missing mass, no
nutrition) that's common to every case, without depending on the shape of any
particular ingredient database. A richer, database-backed golden set (to
exercise mass standardization, yields, nutrition) is a natural future addition
but is out of scope for this initial Phase 0 setup.

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

1. Create `cases/<nnn>-<short-description>/input.gram`, isolating **one**
   grammar/compiler feature per case as much as possible — when a case fails,
   the directory name should already tell you roughly what broke.
2. Run `bun run conformance:update`.
3. **Read the generated JSON before committing it.** The runner will happily
   commit a bug's output as the new "golden" — nothing here checks that the
   output is *correct*, only that it's *stable*. If in doubt, cross-check
   against the manual assertions in `packages/parser/tests/grammar-edge-cases.test.ts`
   or the relevant package's own unit tests.
4. For an intentionally-invalid case (expected to throw), name the directory
   `err-<nnn>-<short-description>` — the runner accepts a directory to have
   *either* the three success goldens *or* `error.json`, decided by which one
   already exists on disk before an `--update` run.

## Known gaps (contributions welcome)

- No cases yet for: scaling (`scale/engine.ts`), shopping-list aggregation
  across sections, warnings emitted by the compiler, or an ingredient
  database exercising real mass/nutrition standardization.
- Only one error case exists (`err-001`). The parser's grammar is
  deliberately lenient (see "robustness against malformed input" in
  `packages/parser/tests/grammar-edge-cases.test.ts` — most malformed input
  does *not* throw), so genuine parse-error cases are rarer than you might
  expect; the `invalidComposite` semantic check is the only one currently
  known. If a new hard-error path is added to the grammar, add a matching
  `err-*` case here.
