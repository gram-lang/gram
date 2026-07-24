---
"@gram-lang/language-server": patch
---

Fixed several ways the language server could crash the whole editor session instead of just failing gracefully: a malformed entry in `ingredients.yaml` (e.g. missing `name`) no longer crashes the server, opening a project in a virtual or remote workspace no longer crashes initialization, and a failed background database reload can no longer take down the process. Formatting, rename, and code actions also now always operate on the current document content instead of a possibly-stale cached version.
