# @gram-lang/modules

[![npm](https://img.shields.io/npm/v/@gram-lang/modules?color=cb3837&style=flat-square)](https://www.npmjs.com/package/@gram-lang/modules)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

*Part of the [Gram monorepo](https://git.gram-lang.org/gram-lang/gram).*

Resolves and composes `@use` import directives. Loads a document's import graph, computes each module's public exports and yield, renames its intermediates to avoid collisions with the host, and splices its sections into a single composed AST — so the whole document is compiled, and ALAP-scheduled, exactly once.

This package defines the host interface (`ModuleHost`) and implements none that touches a disk: file resolution and reading are the caller's job (CLI, language server, conformance runner), so this package stays pure — no built-in Node APIs, no filesystem access of its own. The one host it ships is `createMemoryHost()`, an in-memory `ModuleHost` for places with no real filesystem, like the playground, where a base recipe and its importer can be edited side by side.

---

## 📚 General Documentation

For full syntax specifications, `@use` import rules, and best practices, please refer to the **[Gram Documentation](https://gram-lang.org/docs/)**.

---

## 🛠️ Installation

```bash
npm install @gram-lang/modules
# or
bun add @gram-lang/modules
```

---

## ⚡ Usage

```typescript
import { createMemoryHost, loadModuleGraph, composeRecipe } from '@gram-lang/modules';
import { compile } from '@gram-lang/kitchen';

const host = createMemoryHost({
  '/bases/dough.gram': '## Dough ->&dough\n\nMix @flour{500g} and @water{300ml}.\n',
  '/pizza.gram': '@use "./bases/dough.gram" as &dough\n\n## Bake\n\nTop &dough{250g} and bake.\n'
});

const graph = await loadModuleGraph('/pizza.gram', host);
const composed = composeRecipe(graph, { db: {} });
const compiled = compile(composed.ast);
```

---

## 🏗️ Structure

*   `src/host.ts`: `ModuleHost` interface and `ModuleGraph` types.
*   `src/memory-host.ts`: `createMemoryHost()`, in-memory virtual host.
*   `src/graph.ts`: `loadModuleGraph()`, recursive import loader and cycle detection.
*   `src/exports.ts`: Computes each module's public exports.
*   `src/yield.ts`: Measures imported module yields for scaling and `--stock`.
*   `src/rename.ts`: Renames intermediates to avoid collisions across modules.
*   `src/compose.ts`: `composeRecipe()`, splices composed sections into a single AST.

---

## 📄 License

Licensed under [GPL-3.0-or-later](https://www.gnu.org/licenses/gpl-3.0.html).
