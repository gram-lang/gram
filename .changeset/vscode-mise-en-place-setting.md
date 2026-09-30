---
"@gram-lang/language-server": minor
"gram-lang": minor
---

**Language Server / VS Code**: A new `gram.miseEnPlace` setting chooses when the mise en place is planned, right before each section (`perSection`, the default) or all at the start (`upfront`):

- The preview, the Gantt chart and the total time hint next to the recipe title all follow it
- Changing the setting updates every open recipe right away
- Changing a `gram.*` setting now reaches the language server straight away, without reloading the window (this also applies to `gram.ingredientDatabase.path`)
