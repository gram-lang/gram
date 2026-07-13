---
"@gram-lang/docs": minor
---

Added a bilingual (EN/FR) "API Reference" section covering the programmatic API of `@gram-lang/parser`, `@gram-lang/kitchen`, `@gram-lang/analyzer`, `@gram-lang/renderer`, and `@gram-lang/i18n` — function signatures, options, JSON data formats, and the full warning-code catalogue. Reference tables (warning codes, AST node types, unit conversions, categories) are generated at build time directly from each package's source, so they can't drift out of sync with the code. Also fixed an incorrect `analyze()` call example in `how-to/build-custom-ui.md`.
