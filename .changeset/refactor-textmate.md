---
"@gram-lang/parser": minor
"@gram-lang/docs": patch
"@gram-lang/vscode-extension": patch
---

Refactor TextMate grammar to `@gram-lang/parser`

The TextMate grammar (`gram.tmLanguage.json`) has been moved from `@gram-lang/vscode-extension` to `@gram-lang/parser` to colocate the structural (Ohm) and lexical (TextMate) definitions of the Gram language. 

This resolves architectural issues where consumers like the playground had to perform brittle, deep relative imports into the VSCode extension package. The syntax grammar is now officially exported and accessible via `@gram-lang/parser/textmate`.
