---
"@gram-lang/kitchen": patch
---

**Kitchen**: A percentage of an intermediate declared by a step (`Mix @flour{500 g} ->&dough.`, then `@salt{2% &dough}` in a later section) now finds its target, as one declared by a section title does, instead of raising `VARIABLE_NOT_FOUND` and being shown as a missing target.
