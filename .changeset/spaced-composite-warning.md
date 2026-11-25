---
"@gram-lang/kitchen": patch
"@gram-lang/language-server": patch
---

**Kitchen & Language Server**: A composite written with spaces around `<` (`@lemon zest{1} < @lemon{2}`) now raises a `SPACED_COMPOSITE` warning instead of passing in silence:
  - With the spaces, the line reads as two separate ingredients, so the lemon was bought on top of the zest: two lemons too many on the shopping list, with no message.
  - The recipe still compiles as written; only the warning is new, and nothing changes in the compiled recipe beyond it.
  - In the editor, a one-click quick fix glues `<` back to both ingredients (`@lemon zest{1}<@lemon{2}`).
