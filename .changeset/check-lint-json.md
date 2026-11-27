---
"@gram-lang/cli": minor
"@gram-lang/modules": minor
---

**CLI**: `gram check` now reports exactly what the editor shows, and can write a versioned JSON report for CI and AI agents:
  - It runs the same lint layer as the language server: the same codes at the same `line:col`, the writing checks included (`MISSING_TITLE`, `LOST_INGREDIENT`, `MERGED_STEP_LINE`…), a cause found in a `@use` dependency shown on the `@use` line with a `↳ see base.gram:12:4` line, and the project's `lint.rules` and `// gram-ignore` comments respected.
  - An ingredient missing from the database is now an `UNKNOWN_INGREDIENT` (info) on each of its mentions, with the closest name, instead of one warning per ingredient with no position; the codes the editor hides for lack of a position (`MISSING_MACROS`, `UNKNOWN_MASS`, `MISSING_INGREDIENT` for an ingredient only an import writes) are listed too.
  - `--strict` still makes every warning and info an error, but never a `hint`; since the new checks count, a strict CI run may now fail on them: lower a code to `hint` or turn it off in `lint.rules`, or use `--skip-db` to keep the database out.
  - New `--format json` option: a `{ version: 1, files, diagnostics }` report on stdout with each diagnostic's code, severity, message, `line`/`col` from 1 (UTF-16 columns), documentation link, related places and fixes; the schema is documented and only changes version on an incompatible change.
  - `@gram-lang/modules/lint` (experimental) now gives `UNKNOWN_INGREDIENT` the ingredient's `name` in its `data`, leaves out the analyzer's duplicate `MISSING_INGREDIENT` for an ingredient the file already flags, and exports `buildLineIndex()` and `offsetToPosition()`.
