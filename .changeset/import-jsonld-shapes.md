---
"@gram-lang/cli": patch
---

**CLI**: `gram import` reads more of the ways schema.org lets a site write a recipe, instead of crashing or skipping steps:
  - An ingredient list given as a single text, or mixing in non-text entries, no longer crashes the import.
  - A step whose text is not plain text is skipped instead of crashing the import.
  - Steps and sections whose `@type` is a list are read like any other.
