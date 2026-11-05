---
"@gram-lang/language-server": minor
---

**Language Server**: Editors can now request only active views through a dedicated views protocol:

- A client declaring `initializationOptions.views` specifies open recipe outputs via `gram/setOpenViews` and receives targeted updates in `gram/viewUpdated`: recipe and work plan views as HTML, or AST and compiled JSON as text or interactive trees. Closed outputs are no longer evaluated
- When a recipe encounters compilation errors, open outputs are paused rather than replaced by an error card: editors retain their last valid rendered view, while localized error summaries are provided alongside standard LSP diagnostics
- `gram/setSession` configures transient session parameters for a recipe: target serving time (projecting the work plan onto the calendar in the project's `timezone`), scaling factor, pre-prepared imports in stock, and baker's percentage reference. Sessions are held per document in memory, while compiler diagnostics continue evaluating the recipe as written

**Deprecated**

- Language Server: the `gram/previewUpdated` notification, sent to clients that do not declare the views protocol, is deprecated and will be removed in 2.0.0. Adopt `gram/viewUpdated` with the `recipe` output instead (see the deprecations page of the docs)
