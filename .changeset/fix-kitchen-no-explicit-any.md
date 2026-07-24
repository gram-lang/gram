---
"@gram-lang/kitchen": patch
---

Removed all uses of `any` from the compiler's internal types, replacing them with the real shapes already exported by the package (`Usage`, `CompositeItem`, `StepToken`, etc.). This surfaced and fixed a couple of small bugs: scaling a fraction quantity (`1/2 cup`) produced a malformed value with a `"fraction"` type tag but no numerator/denominator, and a dead code path in shopping-list aggregation.
