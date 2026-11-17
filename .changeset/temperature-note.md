---
"@gram-lang/parser": minor
"@gram-lang/kitchen": minor
"@gram-lang/analyzer": minor
"@gram-lang/renderer": minor
"@gram-lang/cli": minor
---

**Parser & Kitchen**: A temperature can carry a note in parentheses glued to its closing brace, such as the oven mode or where it is measured: `^{160°C}(fan)`, `^oven{180°C}(grill)`, `^{63°C}(internal)`, `^{high heat}(covered)`:
  - Only a parenthesis that touches the `}` is a note, and it ends on the same line: `^{180°C} (the oven must be hot)` keeps its parenthesis in the sentence, as before.
  - The note is shown next to the temperature in every view, on screen, in Markdown, in plain text and in print, and in `gram cook`. `gram cook` now shows temperatures the way the views do (`180 °C`), including those in words (`^{high}`).
  - The AST and the compiled JSON have a new `note` field on temperatures, left out when there is none. `gram diff` reports a note that was added, removed or changed.
  - For integrators, `formatTemperature` (`@gram-lang/renderer`) displays a compiled temperature the way the views do, and the new `noteGroup` class (`note-group` by default) holds a temperature and its note together in HTML.
  - `gram import` keeps the oven mode found in a source recipe as a note instead of leaving it in the prose.
