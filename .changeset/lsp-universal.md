---
"@gram-lang/language-server": minor
"@gram-lang/cli": minor
---

**Language server & CLI**: The language server now works in any editor that speaks the LSP, not only VS Code:
  - `@gram-lang/language-server` ships a `gram-language-server` binary that talks over stdio by default (`--stdio` is accepted), ready for Neovim, Helix, Emacs, Zed or Sublime Text.
  - New `gram lsp` command starts the same server from the CLI, with nothing more to install.
  - An editor without view panels can send `initializationOptions: { views: false }`: it gets diagnostics, completion, hover, formatting and the other standard features, with no HTML rendered on every keystroke and no `gram/*` notification, and the server only sends the requests the client declared it supports.
  - The "Preview" CodeLens is now offered only to clients of the views protocol (`views: true`, the VS Code extension), the only ones that can run it; older clients that send no `views` option keep receiving the deprecated `gram/previewUpdated` until 2.0.0.
