---
"@gram-lang/cli": major
"@gram-lang/language-server": minor
"@gram-lang/docs": minor
---

fix!: gram check only fails on structural errors by default (use --strict for the old behavior), fix LSP completion race and add ingredients.yaml live reload

**Breaking:**

- `gram check` no longer treats every compiler warning as a build-failing error. It now consumes the same `warningSeverity` map as the language server: structural issues (undefined references, scope conflicts) still fail the command; nutritional/estimation gaps and incomplete-but-valid annotations (missing timer/temperature units, an unresolved relative quantity, etc.) are reported but no longer fail it. Pass `--strict` to restore the old all-warnings-fail behavior (recommended for CI).
- `GramConfigError`'s exit code changed from 2 to 1 — a malformed config or ingredient database is a user error, not an internal crash, and `2` is now reserved for the latter.

**Fixed:**

- Language server: completions right after typing `@` or `&` could silently return nothing, because the prefix used to detect the trigger character was read from a 150ms-debounced document snapshot that didn't contain the just-typed character yet. The prefix is now read from the live document on every completion request.
- Language server: diagnostics for compiler warnings now use the same `warningSeverity` map as `gram check` (previously only `UNDEFINED_REFERENCE`/`CIRCULAR_REFERENCE` were hardcoded as errors, everything else as warnings — now centralized in one place both consume).
- Language server: `ingredients.yaml` is now watched via the standard `workspace/didChangeWatchedFiles` LSP mechanism. Editing it outside the editor (`gram db sync`/`enrich`, a hand-edit) refreshes diagnostics without needing an editor restart — previously it was only (re)loaded at startup and on configuration changes.

Docs updated: `gram check --strict`, and the previously-undocumented global `--verbose`/`--debug` flag.
