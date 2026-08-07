---
"@gram-lang/cli": patch
---

Fixed `gram check`'s own `--help` description ("Validate .gram recipe files for syntax and structure errors") being silent about the fact that, by default, it also checks completeness against your ingredient database (`--skip-db` to opt out) — the only place this was previously documented was the full docs site, not the CLI's own inline help.
