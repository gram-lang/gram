# @gram-lang/language-server

[![npm](https://img.shields.io/npm/v/@gram-lang/language-server?color=cb3837&style=flat-square)](https://www.npmjs.com/package/@gram-lang/language-server)
[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)

*Part of the [Gram monorepo](https://git.gram-lang.org/gram-lang/gram).*

The official Language Server Protocol (LSP) implementation for the Gram recipe language. It provides language intelligence such as diagnostics (syntax and logic errors), auto-completion, hover information, and semantic tokens.

---

## 📚 General Documentation

For full syntax specifications, command reference, and best practices, please refer to the **[Gram Documentation](https://gram-lang.org/docs/)**.

---

## 🛠️ Installation

```bash
npm install @gram-lang/language-server
# or
bun add @gram-lang/language-server
```

---

## ⚡ Usage

The package ships a `gram-language-server` binary that speaks the Language Server Protocol over stdio, for any editor with an LSP client (Neovim, Helix, Emacs, Zed, Sublime Text...):

```bash
npm install -g @gram-lang/language-server
gram-language-server --stdio
```

With [`@gram-lang/cli`](../cli/README.md) already installed, `gram lsp` starts the same server. Stdio is the default transport, so `--stdio` is optional.

Configure your editor to run this command for `.gram` files and to send `initializationOptions: { views: false }` in its `initialize` request: you get diagnostics, completion, hover, formatting, rename and semantic tokens, without the HTML views meant for editors with a preview panel. `views: true` opts into the views protocol (what the VS Code extension uses); leaving `views` out keeps the deprecated `gram/previewUpdated` notifications until 2.0.0.

The server only sends the requests a client declares it supports (`workspace/configuration`, dynamic file watcher registration, inlay hint refresh). To stop it, send `shutdown`, wait for the response, then `exit`.

See the [language server reference](https://gram-lang.org/docs/reference/tooling/language-server/) for the full protocol.

---

## 🏗️ Capabilities

The Gram Language Server currently supports:
*   **Diagnostics:** Real-time syntax and semantic validation (including compound quantities, unit ratios, durations, and target states).
*   **Semantic Tokens:** Rich semantic highlighting for ingredients, quantities, cookware, timers, temperatures, and target states (`={...}`).
*   **Hover:** Nutritional information, scaled quantities, duration breakdowns, and unit-ratio details on hover.
*   **Completion:** Suggestions for units (including ratio denominators), ingredients (from the user's local ingredient DB), cookware, and `@use` import paths.
*   **Navigation & Refactoring:** Go to Definition, Find All References, Rename Symbol (`F2` across references, `%`, and unit ratios), Document Symbols (Outline), and Folding Ranges.
*   **Code Actions, Inlay Hints & CodeLens:** Quick fixes for common diagnostics, total time / duration inlay hints, and a `▶ Preview` CodeLens for clients of the views protocol (VS Code).
*   **Document Formatting:** Automatic formatting of `.gram` files to the standard canonical style (powered by [`@gram-lang/format`](../format/README.md)).
*   **Views protocol:** Renders only the views and inspectors currently open in the client (`gram/setOpenViews`) and answers with `gram/viewUpdated` (recipe and run sheet as HTML, AST and compiled JSON as text or an interactive tree). When a recipe has errors, open outputs are paused instead of replaced by an error card, with a localized error summary beside the usual diagnostics. The outputs a client can open are listed, with their names in the editor's language, in the `initialize` result (`capabilities.experimental.gramViews`), so a client shows a new view without an update of its own. Legacy clients continue receiving `gram/previewUpdated` and `gram/ganttUpdated` (both deprecated) until 2.0.0.
*   **Sessions:** `gram/setSession` sets the transient choices of a recipe, held in memory and never written to the file: the serving time (which puts the run sheet on the calendar, in the project's `timezone` and within its `availability`), the scale, the imports already in stock and the baker's reference. `gram/sessionChoices` says what these controls offer for a recipe as written (its ingredients, its `@use` imports, whether baker's math is on), and `gram/serveTimes` proposes the serving times that work over the next days, at the project's `mealTimes`, with the reasons of the others.
*   **Settings and project config:** The `gram.*` settings of the client (`miseEnPlace`, `rests`, `comments`, `stepQuantities`, `nutritionBasis`, `bakersMath`, `massStandardization`, `yieldCalculation`, `nutritionEstimation`...) apply to every open recipe as soon as they change, and so does an edit of `.gram/config.yaml` (`timezone`, `availability`, `paths`). Only the latest version of a document is kept, so a quick edit never goes back to an older one.

---

## 📄 License

This project is licensed under the GPL-3.0 License.
