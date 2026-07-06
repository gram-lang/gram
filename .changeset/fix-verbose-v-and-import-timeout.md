---
"@gram-lang/cli": patch
---

Fixed a regression introduced alongside the new `--verbose` flag where
`gram -v` stopped printing the version and showed the help text instead
(`-v` is citty's own `--version` shorthand — it's no longer swallowed as
part of the verbose flag). Also fixed `gram import`'s fetch timeout message
not showing up when the timeout fires while reading a slow response body
instead of during the initial connection.
