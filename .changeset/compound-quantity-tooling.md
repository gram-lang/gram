---
"@gram-lang/language-server": minor
"gram-lang": minor
"@gram-lang/format": minor
---

**Language Server, VS Code & Format**: Editors and the formatter understand sums of quantities (`@flour{1 cup + 1 tbsp}`):
  - Quick Fixes for the quantity warnings: two quantities written side by side (`{1 cup 5 tbsp}`) become a sum (`{1 cup + 5 tbsp}`), a sum with a percentage takes the result Gram suggests (`{100 g + 10%}` → `{110 g}`), and `oz` after a volume becomes `fl oz`.
  - Hovering an ingredient written as a sum shows what it adds up to (`= 17 tbsp`), or the kinds of amount it keeps apart (a volume and a weight), and its weight when the ingredient database can tell.
  - Unit completion works in each term of a sum, once its number is typed (`{1 cup + 2`).
  - `gram format` and format on save put one space around the `+` and `-` of a sum in an ingredient's braces (`{1 cup-2 tbsp}` → `{1 cup - 2 tbsp}`), never in a range (`{1-2 cups}`), a timer or a temperature, and remove trailing zeros term by term (`{1.50 cup + 2.0 tbsp}` → `{1.5 cup + 2 tbsp}`). The count of these fixes is reported in the new `quantityOperatorSpacing` field.
