---
"@gram-lang/parser": minor
"@gram-lang/kitchen": minor
"@gram-lang/analyzer": minor
"@gram-lang/renderer": minor
"@gram-lang/cli": minor
---

**Parser & Kitchen**: Temperatures can now carry a glued parenthetical note for oven mode or probe placement (`^{160°C}(fan)`, `^oven{180°C}(grill)`, `^{63°C}(internal)`, `^{high heat}(covered)`):
  - Only parentheses touching `}` on the same line are parsed as a note; spaced parentheses remain plain step text.
  - Displayed alongside the temperature in HTML, Markdown, plain text, print, and `gram cook` (which now formats temperatures consistently, including word-based ones like `^{high}`).
  - Adds an optional `note` field on AST and compiled JSON temperatures, tracks note changes in `gram diff`, and exports `formatTemperature` from `@gram-lang/renderer`.
  - `gram import` preserves oven modes as temperature notes rather than leaving them in prose.
