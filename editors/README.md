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

## Smoke tests

`smoke/run.sh` tries these configurations in real editors (Neovim, Helix,
Emacs) inside a throwaway `podman` (or `docker`) container, against the
server built in this checkout: `bun run build`, then

```sh
editors/smoke/run.sh            # every editor
editors/smoke/run.sh neovim     # neovim | helix | emacs
```

Neovim and Emacs go through hover, completion, formatting, rename,
semantic tokens and diagnostics with their own LSP client; Helix has no
headless mode, so `hx --health gram` only checks that the config is read and
the server is found. Sublime Text and JetBrains are tested by hand (checklist
on the docs page).

This folder is not a workspace and is not published.
