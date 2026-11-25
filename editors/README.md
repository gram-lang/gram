# Editor configurations

Reference configurations for using the Gram language server in editors other
than VS Code. Each file is the exact snippet shown on the "Supported editors"
docs page (`packages/docs/.../reference/tooling/editors.mdx`, en + fr), which
imports it through the `@editors` alias instead of copying it.

| Editor | File |
| --- | --- |
| Neovim (0.11+) | `neovim/gram.lua`; Tree-sitter colors: `neovim/build-parser.sh`, `neovim/gram-treesitter.lua` |
| Helix | `helix/languages.toml` (with its Tree-sitter grammar) |
| Emacs (eglot, 29+) | `emacs/gram.el` |
| Sublime Text (LSP package) | `sublime/LSP.sublime-settings`, `sublime/Comments.tmPreferences` |
| JetBrains (LSP4IJ) | `jetbrains/init-options.json` |

Every configuration starts `gram-language-server --stdio` (or `gram lsp`) and
sends `views: false`: these editors have no preview panel. The contract is
checked by `packages/language-server/tests/editors.test.ts`, which also fails
on a file here that the docs page does not import.

Helix and Neovim get their colors from
[tree-sitter-gram](https://github.com/gram-lang/tree-sitter-gram), built at
one pinned commit: `rev` in `helix/languages.toml` and `REV` in
`neovim/build-parser.sh`, which the test keeps equal. To move to a new tag of
the grammar, change both, then run the smoke tests.

## Smoke tests

`smoke/run.sh` tries these configurations in real editors (Neovim, Helix,
Emacs) inside a throwaway `podman` (or `docker`) container, against the
server built in this checkout: `bun run build`, then

```sh
editors/smoke/run.sh            # every editor
editors/smoke/run.sh neovim     # neovim | helix | emacs
```

Neovim and Emacs go through hover, completion, formatting, rename,
semantic tokens and diagnostics with their own LSP client. Helix and Neovim
also build the Tree-sitter grammar, and Neovim checks its colors and section
folds headless. Helix has no headless mode, so `hx --health gram` only checks
that the config is read, the server is found and the highlight queries are in
place. Sublime Text and JetBrains are community starting
configurations provided as-is without continuous manual testing (their config
shape is still checked by `editors.test.ts`).

This folder is not a workspace and is not published.
