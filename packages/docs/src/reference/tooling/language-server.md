# Language Server

The Gram Language Server (`@gram/language-server`) is the intelligence engine behind editor integrations. It implements the standard **Language Server Protocol (LSP)**, making it possible to provide advanced IDE features for Gram files across multiple editors, not just VS Code.

## Architecture

The server acts as a persistent background process that analyzes your `.gram` files using the `@gram/parser` and `@gram/kitchen` packages. 

**The real-time workflow:**
1. ⌨️ **Editor** ➔ Sends file changes on every keystroke.
2. 🧠 **Language Server** ➔ Intercepts changes and asks the Gram Compiler to re-evaluate the AST in memory.
3. ⚙️ **Gram Compiler** ➔ Analyzes the new structure and emits warnings, macros, and dependencies.
4. 🧠 **Language Server** ➔ Translates these into standard LSP payloads (Diagnostics, Semantic Tokens, Inlay Hints) and pushes them back to the editor.

## Supported LSP Features

The Gram Language Server implements the following standard capabilities:

| LSP Capability | Gram Implementation |
|---|---|
| 🚨 **Diagnostics** | Real-time syntax and structural error reporting (e.g., circular dependencies). |
| 🎨 **Semantic Tokens** | AST-driven highlighting for modifiers, units, and composite ingredients. |
| ⚡ **Completion** | Intelligent autocomplete for ingredients, units, and variables. |
| ℹ️ **Hover** | Shows nutritional breakdowns and volume-to-mass conversions. |
| 📍 **Go to Definition** | Navigate from an intermediate reference directly to its declaration. |
| 🔍 **Find References** | Locate all usages of a specific intermediate variable. |
| ✏️ **Rename** | Safely and atomically rename intermediate variables. |
| 💡 **Code Actions** | Quick fixes (declaring missing variables, converting volume to mass). |
| 🪄 **Document Formatting**| Cleans up spacing, composite syntax, and aligns headers. |
| ⏱️ **Inlay Hints** | Displays cumulative preparation times inline within the editor. |
| 📊 **Code Lens** | Injects interactive action buttons (like Macros calculation). |
| 📑 **Document Symbol** | Populates the editor's Outline view for structural navigation. |
| 📁 **Folding Range** | Allows collapsing of recipe `## Sections` and YAML frontmatter. |

## Using in Other Editors

Because it uses the standard LSP protocol, the `@gram/language-server` can be integrated into Neovim, Emacs, Sublime Text, or any other editor that supports LSP. 

::: info Neovim / Emacs Support
Documentation for configuring the language server in Neovim/Emacs is currently a work in progress. Contributions are highly welcome!
:::
