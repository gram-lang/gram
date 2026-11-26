---
"@gram-lang/language-server": minor
"@gram-lang/kitchen": minor
"@gram-lang/modules": minor
---

**Language Server**: The editor now helps write the frontmatter and keeps the recipe's names consistent:
  - In the frontmatter, completion offers the keys Gram knows that are not written yet, each explained in the editor's language, even before the closing `---`; a deprecated key is never offered, and no ingredient or cookware is suggested there.
  - After `#`, `^`, `~` and `~_`, completion offers the cookware, temperatures, timers and tracks the recipe already names, so a track such as `~_oven` is spelled the same way each time.
  - Hovering a frontmatter key shows what it means and the kind of value it takes, with its replacement for a deprecated key.
  - A deprecated frontmatter key (`servings`, `yield`, `yields`) is struck through on its own line, with a Quick Fix that renames it to its replacement (or removes it when the replacement is already written).
  - Kitchen exports `warningInfo` (and `@gram-lang/modules` `warningInfoOf`), each warning code's severity and whether it flags a deprecated form, which the editor reads to strike it through.
