# Gram Language Support

[![VS Code Marketplace](https://vsmarketplacebadges.dev/version-short/gram-lang.gram-lang.svg?style=flat-square&color=007acc)](https://marketplace.visualstudio.com/items?itemName=gram-lang.gram-lang)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

*Part of the [Gram monorepo](https://codeberg.org/abiwab/gram).*

The official Visual Studio Code extension for the Gram recipe language. It provides a full language server with real-time diagnostics, advanced editing assistance, semantic highlighting, and a dynamic Live Preview.

---

## 📚 General Documentation

For full syntax specifications, grammar details, cheatsheets, and best practices, please refer to the **[Gram Documentation](https://gram-lang.org/)**.

---

## 🛠️ Installation

Search for **"Gram - Recipe Language"** in the Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`) and install it, or install it directly from the VS Code Marketplace.

### Building from source

1. Clone the repository and navigate to the project root.
2. Install dependencies and build the monorepo:
   ```bash
   bun install
   bun run build
   ```
3. Navigate to the extension folder and package it using `vsce` (install `vsce` globally if you haven't already: `npm install -g @vscode/vsce`):
   ```bash
   cd packages/vscode-extension
   vsce package
   ```
4. Install the generated `.vsix` file in VS Code:
   - Go to the Extensions view (`Ctrl+Shift+X` or `Cmd+Shift+X`).
   - Click the `...` menu at the top right.
   - Select **Install from VSIX...** and choose the generated file.

---

## ⚡ Features

*   **Language Server Protocol (LSP)**: Real-time diagnostics, missing reference checks, and unused declaration warnings.
*   **Live Preview**: Real-time side-by-side rendering of the recipe with a built-in, togglable nutrition/macros panel.
*   **Smart Autocomplete**: Contextual suggestions for ingredients (from your local YAML database), units, and intermediate references.
*   **Advanced Navigation**: Jump to definition, find all references, outline view, and AST-driven semantic highlighting.
*   **Code Actions**: Quick fixes for common errors and automatic volume-to-mass conversions.
*   **Inlay Hints & CodeLens**: Displays cumulative time and quick action buttons directly in the editor.

---

## 🏗️ Structure

*   `src/extension.ts`: Main entry point for the extension client.
*   `src/preview.ts`: Manages the Live Preview webview panel and HTML rendering.
*   `syntaxes/`: Contains the fallback TextMate grammar for Gram.
*   `snippets/`: Built-in code snippets for standard recipe structures.
*   `../language-server`: The LSP implementation providing all intelligence to this extension.

---

## 📄 License

This project is licensed under the GPL-3.0 License.
