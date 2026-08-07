---
"@gram-lang/cli": patch
---

`gram import` now runs its final output through the same deterministic formatter as `gram format` before writing it. Formatting issues (spacing, trailing decimal zeros, blank lines...) are mechanical fixes that don't need — and shouldn't cost — an extra AI call to correct.
