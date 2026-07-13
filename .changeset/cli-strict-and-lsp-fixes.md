---
"@gram-lang/cli": major
"@gram-lang/language-server": minor
"@gram-lang/docs": minor
---

fix!: `gram check` only fails on structural errors by default (use `--strict` for the old behavior), fix LSP completion race, and add ingredients.yaml live reload

**Breaking:**
- `gram check` now only fails on structural issues (like undefined references) and uses a shared `warningSeverity` map. Nutritional gaps and incomplete annotations are reported as warnings instead of failing the build. Use `--strict` for the old all-warnings-fail behavior.
- `GramConfigError` exit code changed from 2 to 1 (user error, not internal crash).

**Fixed:**
- Language Server: Fixed a race condition where completions immediately after `@` or `&` could return nothing.
- Language Server: Diagnostics now correctly use the shared `warningSeverity` map.
- Language Server: `ingredients.yaml` is now actively watched via LSP. External edits instantly refresh diagnostics without restarting the editor.
