---
"@gram-lang/kitchen": patch
---

The compiler now detects indirect circular dependencies between section intermediates (e.g. section A's result depends on section B's, whose result depends back on section A's) and reports a `CIRCULAR_REFERENCE` warning for each one — previously only a direct self-reference was caught.
