---
"@gram-lang/vscode-extension": minor
"@gram-lang/docs": minor
"@gram-lang/analyzer": minor
"@gram-lang/kitchen": minor
"@gram-lang/renderer": minor
"@gram-lang/parser": minor
---

Core language update to enforce new syntax adjustments (breaking changes).

* **Grammar & Parsing**: 
  * Made `{}` optional for single-word ingredients.
  * Replaced temperature symbol with `°`.
  * Replaced async timers with `~&{}`.
  * Replaced aliases brackets with `:`.
  * Tightened `<@` with no spaces allowed.
  * Added fixed modifier `=`.
  * Mandatory `@&` inside relative quantities declarations. (e.g: `@water{60% @&flour}`)
  * **Top-Level Support**: Allowed writing comments and recipe steps globally, anywhere in the document (even before the first `## Section`).
* **Compiler Analysis**: 
  * Added `INVALID_MODIFIER_COMBINATION` warnings.
  * Updated AST transformations to support the new modifiers parsing rules and the implicit top-level sections grouping.
