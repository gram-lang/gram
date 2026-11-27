---
"@gram-lang/cli": minor
"@gram-lang/modules": minor
---

**CLI**: New `gram check --fix` option, which applies the safe fixes in place and reports what is left:
  - It applies the fixes marked as preferred, those that leave no doubt about the intent (`~{15%min}` → `~{15 min}`, a spaced composite, `&flour` for a raw ingredient, a deprecated frontmatter key, a missing blank line between two steps…), lints again and repeats, five passes at most, then ends on `N fixes applied, M remaining`.
  - It only edits the files it checks, never a `@use` dependency nor the ingredient database, and never creates a file; a recipe that parsed still parses, and a fixed problem does not come back. Each file is written once, only when it changed.
  - It follows `lint.rules` and `// gram-ignore`, and never renames an unknown ingredient to the closest name; the exit code is that of the check after the fixes.
  - With `--format json`, each entry of `files` gives the number of fixes applied to it (`fixed`), and `diagnostics` lists what is left; the report stays at `version: 1`.
  - `@gram-lang/modules/lint` (experimental) exports `applyPreferredFixes()`, the pure pass behind `--fix`.
