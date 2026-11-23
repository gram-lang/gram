# Editor configurations

Reference configurations for using the Gram language server in editors other
than VS Code. Each file is the exact snippet shown on the "Supported editors"
docs page (`packages/docs/.../reference/tooling/editors.mdx`, en + fr), which
imports it through the `@editors` alias instead of copying it.

| Editor | File |
| --- | --- |
| Neovim (0.11+) | `neovim/gram.lua` |
| Helix | `helix/languages.toml` |
| Emacs (eglot, 29+) | `emacs/gram.el` |
| Sublime Text (LSP package) | `sublime/LSP.sublime-settings`, `sublime/Comments.tmPreferences` |
| JetBrains (LSP4IJ) | `jetbrains/init-options.json` |

Every configuration starts `gram-language-server --stdio` (or `gram lsp`) and
sends `views: false`: these editors have no preview panel. The contract is
checked by `packages/language-server/tests/editors.test.ts`, which also fails
on a file here that the docs page does not import.

This folder is not a workspace and is not published.
