---
"@gram/parser": minor
"@gram/playground": patch
"@gram/vscode-extension": patch
---

Refactor TextMate grammar to `@gram/parser`

The TextMate grammar (`gram.tmLanguage.json`) has been moved from `@gram/vscode-extension` to `@gram/parser` to colocate the structural (Ohm) and lexical (TextMate) definitions of the Gram language. 

This resolves architectural issues where consumers like the playground had to perform brittle, deep relative imports into the VSCode extension package. The syntax grammar is now officially exported and accessible via `@gram/parser/textmate`.
