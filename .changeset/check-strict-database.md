---
"@gram-lang/cli": minor
---

**CLI**: `gram check --strict` now also fails on ingredients missing from the database, as its description always said; use `--skip-db` to keep the database out of a strict CI run.
