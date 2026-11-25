---
"@gram-lang/cli": patch
---

**CLI**: A syntax error in the recipe file itself is reported again by every command (`view`, `export`, `print`, `build`, `plan`, `shop`, `scale`, `cook`…), which now exit with an error: they used to show an empty recipe and succeed, only `gram check` saying what was wrong. A syntax error in an imported module stays a diagnostic, as before.
