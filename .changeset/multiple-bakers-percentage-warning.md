---
"@gram-lang/kitchen": patch
---

**Kitchen**: Marking two different ingredients as the baker's-percentage base (`@*flour{500 g}` and `@*rye{100 g}`) no longer stops compilation with an error, which used to wipe every other diagnostic in the editor. The first ingredient marked stays the base, the others lose their `*` with a new `MULTIPLE_BAKERS_PERCENTAGE` warning, and the rest of the recipe compiles as usual.
