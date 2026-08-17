# @gram-lang/modules

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

*Part of the [Gram monorepo](https://git.gram-lang.org/gram-lang/gram).*

Resolves and composes `@use` import directives (see `.notes/plan-ajout-imports-recettes.md`). Loads a document's import graph, computes each module's public exports and yield, renames its intermediates to avoid collisions with the host, and splices its sections into a single composed AST — so the whole document is compiled, and ALAP-scheduled, exactly once.

This package defines the host interface (`ModuleHost`) but never implements it: file resolution and reading are the caller's job (CLI, language server, playground, conformance runner), so this package stays pure — no built-in Node APIs, no filesystem access of its own.

---

Licensed under [GPL-3.0-or-later](https://www.gnu.org/licenses/gpl-3.0.html).
