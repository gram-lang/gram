---
"@gram-lang/parser": minor
"@gram-lang/language-server": patch
---

`getAST` now throws `GramParseError` (exported, extends `Error`) instead of a plain `Error` on syntax errors. `error.message` is unchanged — still ohm-js's human-readable prose — so existing `catch (e) { ... e.message }` code keeps working. New structured fields `offset: number` and `expected: string` are now available for callers that want to build a real editor range instead of guessing at a fixed position.

The language server now uses `offset` to report parse-error diagnostics at their actual location in the document, instead of always at line 1 column 1.
