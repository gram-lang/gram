---
"@gram-lang/renderer": patch
---

**Rendering**: Fixed a missing space between two elements written one after the other in a step, such as an ingredient followed by a timer or by cookware (`@flour{500 g} ~{1h}` read "flour (500 g)1 h"), in every view and in `gram view`.
