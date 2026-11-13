# Gram Language Support

[![VS Code Marketplace](https://vsmarketplacebadges.dev/version-short/gram-lang.gram-lang.svg?style=flat-square&color=007acc)](https://marketplace.visualstudio.com/items?itemName=gram-lang.gram-lang)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

*Part of the [Gram monorepo](https://git.gram-lang.org/gram-lang/gram).*

The official Visual Studio Code extension for the Gram recipe language. It provides a full language server with real-time diagnostics, advanced editing assistance, semantic highlighting, and a dynamic Live Preview.

---

## 📚 General Documentation

For full syntax specifications, grammar details, cheatsheets, and best practices, please refer to the **[Gram Documentation](https://docs.gram-lang.org/)**.

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
*   **Live Preview**: Real-time side-by-side rendering of the recipe, with its nutrition summary always shown (`Gram: Macros` jumps to the table). **Scale and stock** at the top lets you set the portions, a scale or a target quantity, the baker's reference and the imports you already made, for this sitting only.
*   **Run Sheet View**: Shows the plan of your recipe: the days, when you are in the kitchen, what to take out for each visit and what goes on in between. A **Served at** field puts it on the calendar in your project's time zone and hours (`timezone` and `availability` in `.gram/config.yaml`), and **When to serve?** proposes the times that work over the next days. It replaces the Gantt chart (`Gram: Gantt Chart` now opens it, and is removed in 2.0.0).
*   **Views and inspectors**: `Gram: Show View...` lists every view (recipe, run sheet) and the technical inspectors (composed AST and compiled JSON as text or an interactive tree). Open panels follow the active editor, update live, and keep their last valid rendering, under a banner, while the recipe has errors.
*   **Settings**: The `gram.*` settings choose what the preview and the run sheet show, with the same values and defaults as the CLI and the playground: when the mise en place is planned (`gram.miseEnPlace`), how long a rest written as a range lasts (`gram.rests`), the comments (`gram.comments`), the quantities in the steps (`gram.stepQuantities`), the nutrition basis and baker's percentages, and what is computed from your ingredient database (`gram.massStandardization`, `gram.yieldCalculation`, `gram.nutritionEstimation`, `gram.bakersMath`). A change applies to every open recipe right away.
*   **Smart Autocomplete**: Contextual suggestions for ingredients (from your local YAML database), units, and intermediate references.
*   **Advanced Navigation**: Jump to definition, find all references, outline view, and AST-driven semantic highlighting.
*   **Code Actions & Formatting**: Automatic document formatting (`Format Document` / `Format on Save` via `@gram-lang/format`), quick fixes for common errors, and volume-to-mass conversions.
*   **Inlay Hints & CodeLens**: Displays the total time, in the recipe's language, and quick actions directly in the editor.

---

## 🏗️ Structure

*   `src/extension.ts`: Main entry point for the extension client.
*   `src/views/`: Generic webview panels tracking outputs advertised by the language server (recipe, run sheet, inspectors), automatically following the active editor and handling error-paused states.
*   `syntaxes/`: Contains the fallback TextMate grammar for Gram.
*   `snippets/`: Built-in code snippets for standard recipe structures.
*   `../language-server`: The LSP implementation providing all intelligence to this extension.

---

## 📄 License

This project is licensed under the GPL-3.0 License.
