---
"@gram-lang/renderer": minor
---

**Renderer / Views**: A new `prepareViews()` gathers everything a view of a recipe is built from, worked out once and only when a view asks for it:

- the timeline for the chosen settings and its total and idle times, the same at any serving time
- the work plan, on the calendar when a serving time is given, otherwise in days before the service
- the serving time search (the earliest serving time, and the times worth proposing in a range) from your kitchen's time zone and hours
- `views` lists the views of a recipe (the recipe, the work plan) with the formats each one offers, the settings it follows and what it needs worked out, and `render(view, input, format)` writes one of them from what `prepareViews()` gave; it returns `null` for a work plan when the recipe has no tasks. `toHTML`, `runSheetToHTML` and the other functions stay as they are
- `inspectors` lists the looks at the pipeline (the composed AST as an S-expression, the analyzed recipe as JSON or as a tree that folds), and `outputs` lists the views and the inspectors together, for an interface that offers both. `renderJsonTree()` writes any data as that tree, with no script (native folding, keyboard included), and `JSON_TREE_CSS` styles it with colors you set through CSS variables; `renderSExpr()` writes an AST as an S-expression
