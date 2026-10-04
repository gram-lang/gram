---
"@gram-lang/cli": minor
---

**CLI / View & Export**: `gram view`, `gram export` and `gram print` accept a new `--mise-en-place <per-section|upfront|per-session>` option, to see the recipe with the mise en place planned right before each section (the default), all at the start, or at the start of each working day:

- The total and idle times shown follow the chosen option; the active and preparation times stay the same
