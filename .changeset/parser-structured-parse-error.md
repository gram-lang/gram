---
"@gram-lang/parser": minor
"@gram-lang/language-server": patch
---

`getAST` now throws `GramParseError` instead of a plain `Error` on syntax errors. This new error type includes structured fields (`offset` and `expected`) while preserving the original human-readable message.

The language server now uses the `offset` field to report parse-error diagnostics at their exact location in the document, rather than defaulting to line 1 column 1.
