# Language Server

The Gram Language Server (`@gram/language-server`) is the intelligence engine behind editor integrations. It implements the standard **Language Server Protocol (LSP)**, making it possible to provide advanced IDE features for Gram files across multiple editors, not just VS Code.

## Architecture

The server acts as a persistent background process that analyzes your `.gram` files using the `@gram/parser` and `@gram/kitchen` packages. 

When you type in your editor, the editor sends the changes to the language server. The server recompiles the recipe in memory, checks for errors, and sends back diagnostics and autocomplete suggestions.

## Supported LSP Features

The Gram Language Server implements the following standard LSP capabilities:

- **Diagnostics**: Real-time syntax and structural error reporting (e.g., circular dependencies, missing variables).
- **Completion**: Intelligent autocomplete for ingredients, units, and intermediate variables based on your project's `ingredients.yaml` database.
- **Hover**: Shows nutritional breakdowns and mass conversions when hovering over ingredients.
- **Go to Definition**: Navigate from an intermediate reference (`&dough`) directly to its declaration (`->&dough`).
- **Find References**: Find all places where a specific intermediate variable is used.
- **Rename**: Safely rename intermediate variables across your entire document.
- **Code Actions**: Quick fixes for common issues (like declaring missing variables or adding missing frontmatter fields).
- **Document Formatting**: Applies standard Gram formatting rules to clean up whitespace and braces.
- **Inlay Hints**: Displays calculated preparation times inline within the editor.

## Using in Other Editors

Because it uses the standard LSP protocol, the `@gram/language-server` can be integrated into Neovim, Emacs, Sublime Text, or any other editor that supports LSP. 

*(Documentation for configuring the language server in Neovim/Emacs is currently a work in progress. Contributions are welcome!)*
