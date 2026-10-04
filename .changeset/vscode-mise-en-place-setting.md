---
"@gram-lang/language-server": minor
"gram-lang": minor
---

**Language Server / VS Code**: A new `gram.miseEnPlace` setting chooses when the mise en place is planned, right before each section (`perSection`, the default), all at the start (`upfront`) or at the start of each working day (`perSession`):

- The preview, the Gantt chart and the total time hint next to the recipe title all follow it
- Changing the setting updates every open recipe right away, and a recipe already open when the editor starts follows it too
- Changing a `gram.*` setting now reaches the language server straight away, without reloading the window (this also applies to `gram.ingredientDatabase.path`)
- A new `gram.rests` setting (`shortest` by default, `balanced` or `longest`) chooses how long a rest written as a range (`~_{12-24h}`) lasts in the same three places
- A working day pushed out of its 24 hours by a long rest is flagged on its section (the new `SESSION_OVERFLOW` warning)
