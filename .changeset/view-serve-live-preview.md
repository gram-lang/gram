---
"@gram-lang/cli": minor
---

**CLI**: `gram view <file> --serve` opens a live preview of the recipe in the browser, for any editor:
  - The page updates in place on every save of the recipe, its `@use` imports, the config or the ingredient database, including saves through a temporary file (Neovim, Helix, Zed), and keeps the last valid page under a banner while the recipe has a syntax error.
  - It has a tab for each view with a screen layout (the recipe and its run sheet) and a button that prints the view shown, exactly as `gram print` would.
  - Every flag of `gram view` applies to it; `--mise-en-place`, `--rests` and `--clock` now shape the run sheet tab. `--port <n>`, `--no-open` and `--view <recipe|run-sheet>` set the port, skip opening the browser and choose the first tab.
  - The server listens on `127.0.0.1` only and refuses requests for another host name. `gram view` now refuses an extra argument, such as a serving time written after `--serve` the `gram plan` way.
