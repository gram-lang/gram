---
"@gram-lang/parser": minor
"@gram-lang/i18n": minor
---

**Parser & Kitchen**: Units written with abbreviation dots are now understood:

- `{1/2 c.à.s}`, `{1 c. à c.}`, `{2 fl. oz.}` and similar spellings now parse and are recognized as the same unit as `càs`, `càc` or `fl oz`

**Fixed**

- A quantity in braces that can't be read (for example `@salt{1 g/l}` or a missing `}`) is now reported as an error pointing at the brace, instead of being ignored and merging the ingredient with others that share the same first word
