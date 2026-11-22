---
"@gram-lang/kitchen": patch
---

**Kitchen**: A composite parent also used whole (`@eggs{1}` next to `@egg yolks{2}<@eggs{2}`) can now be the target of `--scale`: it was refused with "only used inside the eggs sub-recipe, scale eggs instead", which pointed back at itself.
