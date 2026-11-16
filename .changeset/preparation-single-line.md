---
"@gram-lang/parser": patch
---

**Parser**: Fixed an unclosed parenthesis after an ingredient, a composite parent or cookware (`@flour{200g}(sifted and`) that silently swallowed the rest of the recipe up to the next `)`, steps and sections included. A preparation now ends on its line: an unclosed parenthesis stays in the text of the step, and what follows is read as usual. A preparation spread over two lines of the same step is now read as text too.
