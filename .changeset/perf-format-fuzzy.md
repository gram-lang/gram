---
"@gram-lang/cli": patch
---

`gram format` now processes files concurrently (like `gram build`/`gram db sync`)
instead of one at a time, significantly speeding up runs over large recipe
collections. `gram db sync`'s fuzzy-match detection also skips a fast
length-based pre-check before running the full similarity comparison, speeding
up sync runs against larger ingredient databases.
