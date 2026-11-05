---
"gram-lang": minor
---

**VS Code**: Unified view panels and new developer inspectors:

- A new `Gram: Show View...` command lists all available views and opens the selected one: recipe preview, operational work plan, and developer inspectors (composed AST and compiled JSON, formatted as source text or an interactive tree). Existing commands `Gram: Live Preview`, `Gram: Work Plan`, and `Gram: Macros` remain available as direct shortcuts
- Open panels automatically follow the active `.gram` editor tab, and the language server computes only panels that are currently visible
- When a recipe contains errors, active panels pause and retain their last valid rendered state (dimmed beneath a banner with a shortcut button jumping to the error location) instead of blanking or displaying redundant error cards
- Panels hidden in inactive editor tabs automatically refresh to the latest version when brought back into focus
