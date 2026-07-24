---
"@gram-lang/cli": patch
---

Warnings about invalid ingredient database entries now go to stderr instead of stdout, so commands like `gram build recipe.gram | jq` no longer break when the database has a bad entry.
