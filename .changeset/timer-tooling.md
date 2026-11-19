---
"@gram-lang/language-server": minor
"gram-lang": minor
"@gram-lang/parser": minor
---

**Language Server & VS Code**: Editors now understand natural timer and anchor syntax:
  - Hovering a timer shows its normalized duration (`~{1:30 h}` → `1 h 30 min`), and hovering a section anchor shows its lead time and whether it starts a separate working day.
  - Unit completion inside `~{…}` suggests only time units (and no longer offers time units for ingredients).
  - Syntax highlighting distinguishes numbers and units in `~{1h30}`, `~{1:30 h}`, `~{5'30"}`, and duration ranges.
