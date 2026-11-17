---
"@gram-lang/analyzer": patch
---

**Analyzer**: `analyze()` no longer adds its warnings to the compiled result it is given: analyzing the same recipe again (as the editor and the playground do on every change) no longer piles up copies of the same `RELATIVE_QUANTITY_UNKNOWN_MASS` or Baker's percentage warnings, and the compiled result keeps only the compiler's own warnings.
