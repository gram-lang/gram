# @gram-lang/language-server

[![npm version](https://badge.fury.io/js/@gram-lang%2Flanguage-server.svg)](https://www.npmjs.com/package/@gram-lang/language-server)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

*Part of the [Gram monorepo](https://git.gram-lang.org/gram-lang/gram).*

The official Language Server Protocol (LSP) implementation for the Gram recipe language. It provides language intelligence such as diagnostics (syntax and logic errors), auto-completion, hover information, and semantic tokens.

---

## 📚 General Documentation

For full syntax specifications, command reference, and best practices, please refer to the **[Gram Documentation](https://docs.gram-lang.org/)**.

---

## 🛠️ Installation

```bash
npm install @gram-lang/language-server
# or
bun add @gram-lang/language-server
```

---

## ⚡ Usage

This package is intended to be consumed by editor extensions or IDEs that support the Language Server Protocol (e.g., VS Code, Neovim, Emacs, Zed, Monaco Editor).

If you are developing a client extension, you can launch the server process using Node.js:

```javascript
import { LanguageClient } from 'vscode-languageclient/node';

const serverModule = require.resolve('@gram-lang/language-server');

const client = new LanguageClient(
  'gramLanguageServer',
  'Gram Language Server',
  {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc }
  },
  {
    documentSelector: [{ scheme: 'file', language: 'gram' }]
  }
);

client.start();
```

---

## 🏗️ Capabilities

The Gram Language Server currently supports:
*   **Diagnostics:** Real-time syntax and semantic validation.
*   **Semantic Tokens:** Rich semantic highlighting for ingredients, quantities, cookware, and timers.
*   **Hover:** Nutritional information and scaled quantities on hover.
*   **Completion:** Suggestions for units, ingredients (based on the user's local ingredient DB), and cookware.
*   **Document Formatting:** Automatic formatting of `.gram` files to the standard canonical style (powered by [`@gram-lang/format`](../format/README.md)).
*   **Views protocol:** Renders only the views and inspectors currently open in the client (`gram/setOpenViews`) and answers with `gram/viewUpdated` (recipe and run sheet as HTML, AST and compiled JSON as text or an interactive tree). When a recipe has errors, open outputs are paused instead of replaced by an error card, with a localized error summary beside the usual diagnostics. The outputs a client can open are listed, with their names in the editor's language, in the `initialize` result (`capabilities.experimental.gramViews`), so a client shows a new view without an update of its own. Legacy clients continue receiving `gram/previewUpdated` and `gram/ganttUpdated` (both deprecated) until 2.0.0.
*   **Sessions:** `gram/setSession` sets the transient choices of a recipe, held in memory and never written to the file: the serving time (which puts the run sheet on the calendar, in the project's `timezone` and within its `availability`), the scale, the imports already in stock and the baker's reference. `gram/sessionChoices` says what these controls offer for a recipe as written (its ingredients, its `@use` imports, whether baker's math is on), and `gram/serveTimes` proposes the serving times that work over the next days, at the project's `mealTimes`, with the reasons of the others.
*   **Settings and project config:** The `gram.*` settings of the client (`miseEnPlace`, `rests`, `comments`, `stepQuantities`, `nutritionBasis`, `bakersMath`, `massStandardization`, `yieldCalculation`, `nutritionEstimation`...) apply to every open recipe as soon as they change, and so does an edit of `.gram/config.yaml` (`timezone`, `availability`, `paths`). Only the latest version of a document is kept, so a quick edit never goes back to an older one.

---

## 📄 License

This project is licensed under the GPL-3.0 License.
