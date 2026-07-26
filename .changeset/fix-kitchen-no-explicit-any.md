---
"@gram-lang/kitchen": patch
---

Removed all uses of `any` from the compiler's internal types, replacing them with the real shapes already exported by the package (`Usage`, `CompositeItem`, `StepToken`, etc.), and cleaned up dead code paths in shopping-list aggregation.
