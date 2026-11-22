---
"@gram-lang/parser": patch
---

**Parser**: Symbols that are not followed by a name now stay plain text, instead of adding a phantom tool, ingredient or reference to the recipe:
  - A name made only of element symbols (`Mix ## well.`, `@@`, `#~`, `&&`, a `###` line) is read as text, like `@` or `#` alone already was. Names that merely contain them (`#C#-shaped`, `@#5`) are unchanged.
  - An `&` followed by a space is text: `salt & pepper` or `rock & roll` no longer reference an intermediate called `pepper` or `roll`, with a warning that it was never declared. A reference is written with its name right after the `&` (`&dough`).
