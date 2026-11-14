---
"@gram-lang/language-server": minor
"gram-lang": minor
"@gram-lang/parser": minor
---

**Language Server & VS Code**: Editors understand timers written the natural way:
  - Hovering a timer shows how Gram reads it, as the views display it and in the recipe's language (`~{1:30 h}` → `1 h 30 min`). Hovering a section anchor shows how long before it is used the section is ready, and whether it opens a working day of its own (only an anchor in days does).
  - Inside `~{…}`, unit completion only offers time units (`min`, `h`, `hr`, `heures`…), and no longer offers time units for an ingredient.
  - Syntax highlighting tells numbers from units in `~{1h30}`, `~{1:30 h}`, `~{5'30"}` and ranges such as `~{45 min - 1 h}`.
