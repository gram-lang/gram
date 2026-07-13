---
"@gram-lang/cli": patch
---

Performance improvements for CLI tools:
- `gram format` now processes files concurrently, significantly speeding up execution on large recipe collections.
- `gram db sync` now uses a length-based pre-check for fuzzy matching to speed up similarity comparisons against large databases.
