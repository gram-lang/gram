---
"@gram-lang/cli": patch
---

Improved `gram import`'s guidance after writing a file:
- It now reports the compiler warnings left in its output (e.g. "not found in database") instead of silently discarding them, labeled "Warnings" instead of the previous, inaccurate "Could not parse".
- Its next-step hint now points to `gram db sync` first instead of `gram check` — a freshly imported recipe's ingredients are, by definition, not yet in the database, so checking first would just flag every one of them as noise.
