---
"@gram-lang/analyzer": patch
---

The ingredient database schema no longer requires `density` on every entry that has a `physical` block — an ingredient described only by `unit_weight` (e.g. "1 avocado") is valid, matching the analyzer's own documented example. Previously, `gram db enrich` could write entries that `gram build`/`gram db validate` would then reject.
