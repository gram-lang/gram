---
"@gram-lang/cli": minor
---

**CLI**: Added automatic update checking and a new `gram upgrade` command:
- gram now checks npm in the background and prints a short "update available" notice after a command finishes (skipped in CI and non-interactive runs).
- Added `gram upgrade` to check for and install the latest version on demand — it always performs a fresh check and asks for confirmation before running the install.
- Added an `updateCheck: false` setting in `config.yaml` (or the `GRAM_NO_UPDATE_CHECK` environment variable for a single run) to opt out of the passive notice.
