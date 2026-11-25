---
"@gram-lang/parser": minor
---

**Parser**: The package now also ships the TextMate grammar as a property list, `syntaxes/gram.tmLanguage`, next to `gram.tmLanguage.json`: Sublime Text reads this format, recognizes `.gram` files on its own and colors them like VS Code does. It is generated from the JSON grammar at build time, so both always match.
