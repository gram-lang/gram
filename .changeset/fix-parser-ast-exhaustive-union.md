---
"@gram-lang/parser": patch
"@gram-lang/kitchen": patch
"@gram-lang/language-server": patch
---

`ASTNode` is now a fully exhaustive, discriminated union that matches what the parser actually produces (`CompositeAST`, `QuantityAST`, `TextQuantityAST`, and `RelativeQuantityAST` were previously missing from it), and composite ingredients (`<@parent`) now carry source location info like every other node.

Making these types honest surfaced and fixed three real bugs in the language server: outline (document symbols), syntax highlighting (semantic tokens), and go-to-definition/rename/hover (reference and intermediate lookups) could silently miss or crash on content that isn't wrapped in a `## Section` header — a recipe with no headers at all, or with a comment before the first header.
