---
"@gram-lang/language-server": minor
"gram-lang": minor
"@gram-lang/format": minor
---

**Language Server, VS Code & Format**: Editors and the formatter now support sums of quantities (`@flour{1 cup + 1 tbsp}`):
  - Quick fixes convert adjacent quantities into a sum (`{1 cup 5 tbsp}` → `{1 cup + 5 tbsp}`), apply suggested percentage resolutions (`{100 g + 10%}` → `{110 g}`), and clarify `oz` after a volume as `fl oz`.
  - Hover previews show the combined total (`= 17 tbsp`) or distinct unit kinds, along with estimated weight from the ingredient database.
  - Unit completion works inside each term of a sum once its number is typed (`{1 cup + 2`).
  - `gram format` spaces `+` and `-` in ingredient sums (leaving ranges, timers, and temperatures untouched) and trims trailing zeros across quantities (`{1.50 kg}` → `{1.5 kg}`, `~{1.50 h}` → `~{1.5 h}`), reporting operator spacing fixes in `quantityOperatorSpacing`.
