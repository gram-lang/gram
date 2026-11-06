---
"@gram-lang/renderer": minor
---

**Renderer / Views**: A new `prepareViews()` gathers everything a view of a recipe is built from, worked out once and only when a view asks for it:

- the timeline for the chosen settings and its total and idle times, the same at any serving time
- the run sheet, on the calendar when a serving time is given, otherwise in days before the service
- the serving time search (the earliest serving time, and the times worth proposing in a range) from your kitchen's time zone and hours; `suggestServeTimes()` puts it in words for a serving time field: the times that work over the next days, why the others do not, and the earliest
- `views` lists the views of a recipe (the recipe, the run sheet) with the formats each one offers, the settings it follows and what it needs worked out, and `render(view, input, format)` writes one of them from what `prepareViews()` gave; it returns `null` for a run sheet when the recipe has no tasks. `toHTML`, `runSheetToHTML` and the other functions stay as they are
- `inspectors` lists the looks at the pipeline (the composed AST as an S-expression, the analyzed recipe as JSON or as a tree that folds), and `outputs` lists the views and the inspectors together, for an interface that offers both. `renderJsonTree()` writes any data as that tree, with no script (native folding, keyboard included), and `JSON_TREE_CSS` styles it with colors you set through CSS variables; `renderSExpr()` writes an AST as an S-expression
- `describeError()` picks the error to show when a recipe stops compiling (a blocking error first, then the first error) and gives its code, message, file and position, with a title in the recipe's language, so every interface reports the same error the same way
