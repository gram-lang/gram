---
"@gram-lang/cli": patch
---

Added a global `--verbose`/`--debug` flag (works with any subcommand) that
prints the full stack trace alongside the usual terse error message —
useful when filing a bug report or diagnosing an unexpected failure.
