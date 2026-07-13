---
"@gram-lang/cli": patch
---

`gram check` now resolves syntax error line numbers from the parser's structured `GramParseError.offset` instead of regexing "line N" out of ohm's prose message — line numbers are now always correct, not just when they happened to match that pattern.
