---
"@gram-lang/i18n": minor
---

**Playground**: The views of a recipe are now in front, and each one is shown in every format it has:

- The recipe and the run sheet are tabs above the output, always in sight. The inspectors (the AST, the JSON, the JSON tree) sit behind one quieter Inspect tab on the right, and the bar above them chooses which one
- When the tabs no longer fit, on a phone or in a narrow output column, they turn into a single dropdown with the same choices
- Every dropdown of the playground (the recipe examples, the output menus, the settings) now looks and works like the site's language and theme selectors
- A slim bar above the view holds what changes with it, starting with a format menu that shows the view as HTML, Markdown or text. The run sheet can now be read and copied in Markdown and in plain text too. The recipe in Markdown, which had its own entry, is now a format of the recipe
- A new Print button, in the same bar, opens the view in its print layout, to print it or save it as a PDF
- On a narrow output column, the Inspect tab shrinks to its icon so the tabs keep the room
- The JSON tree folds with the keyboard too
- A run sheet with nothing to schedule now says so instead of staying blank
- The "Schedule & Service" settings now say what they change: mostly the run sheet, and in the recipe only the total and idle times, with a link that opens the run sheet
- The "Portions & Scale" settings have a Portions field: type how many portions you want and every quantity follows. A click on the portions of the recipe opens these settings, which replace the small stepper the recipe used to show

**Deprecated**

- `@gram-lang/i18n`: the labels of the old view selector (`playground.viewLabel`, and `playground.views.json`, `ast`, `jsonTree`, `markdown`, `preview` and `runSheet`) are removed in 2.0.0. Use `renderer.outputs` (by output id), `renderer.formats` and `playground.output.views` / `inspect`
