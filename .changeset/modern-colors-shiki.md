---
"@gram/playground": minor
"@gram/vscode-extension": patch
---

- **Playground**: Migrated syntax highlighting engine from Highlight.js to Shiki. The playground now natively uses the official VSCode TextMate grammar, ensuring 100% consistency across environments.
- **VSCode Extension**: Improved syntax coloring by mapping custom Gram tokens (cookware, intermediate ingredients, units) to standard semantic TextMate scopes, restoring vibrant and legible colors across all VSCode themes.
