---
"@gram-lang/analyzer": patch
---

**Analyzer**: `analyze()` no longer mutates the compiled recipe's warnings array, preventing duplicate warnings when re-analyzing the same recipe in editors and the playground.
