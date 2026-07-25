# @gram-lang/language-server

[![npm version](https://badge.fury.io/js/@gram-lang%2Flanguage-server.svg)](https://www.npmjs.com/package/@gram-lang/language-server)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

*Part of the [Gram monorepo](https://codeberg.org/abiwab/gram).*

The official Language Server Protocol (LSP) implementation for the Gram recipe language. It provides language intelligence such as diagnostics (syntax and logic errors), auto-completion, hover information, and semantic tokens.

---

## 📚 General Documentation

For full syntax specifications, command reference, and best practices, please refer to the **[Gram Documentation](https://gram-lang.org/)**.

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
*   **Live Preview & Gantt Streams:** Pushes rendered HTML (`gram/previewUpdated`) and interactive Gantt chart HTML fragments (`gram/ganttUpdated`) to editor client webviews on document edits.

---

## 📄 License

This project is licensed under the GPL-3.0 License.
