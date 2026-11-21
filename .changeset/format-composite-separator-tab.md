---
"@gram-lang/format": patch
---

**Formatter**: `gram format` and format-on-save now join a composite written with tabs around its `<` (`@yolks{3} < @eggs{3}` typed with tabs) in one pass, instead of leaving spaces that a second format removed.
