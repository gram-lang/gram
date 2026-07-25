---
"@gram-lang/renderer": patch
---

`toMarkdown` now neutralizes raw HTML (`<` and `&`) in recipe titles, ingredient names, and step text. Previously, a recipe containing something like `<img onerror=...>` in its title would pass through untouched, which could run as a script if that Markdown was later converted to HTML — this is now escaped automatically, closing that gap for imported or shared recipes.
