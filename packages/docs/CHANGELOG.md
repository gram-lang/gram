# @gram-lang/docs

## 1.4.0

### Minor Changes

- **Playground**: The views of a recipe are now in front, and the studio offers every setting:

  - The recipe and the run sheet are tabs above the output, always in sight. The inspectors (the AST, the JSON, the JSON tree) sit behind one quieter Inspect tab on the right, and turn into a dropdown when the tabs no longer fit, on a phone or in a narrow output column
  - A slim bar above the view holds what changes with it, starting with a format menu that shows the view as HTML, Markdown or text (the run sheet can now be read and copied in Markdown and in plain text too), and a Print button opens the view in its print layout, to print it or save it as a PDF
  - Every setting of a recipe is now offered, including the quantities in the steps and the nutrition basis, and remembered in the browser (except the serving time, which belongs to the visit); yield management and baker's percentages are on by default, as on the command line and in the editor
  - The "Schedule & Service" settings say what they change (mostly the run sheet, and in the recipe only the total and idle times), and the "Portions & Scale" settings have a Portions field, opened by a click on the portions of the recipe, which replaces the small stepper the recipe used to show

  **Deprecated**

  - `@gram-lang/i18n`: the labels of the old view selector (`playground.viewLabel`, and `playground.views.json`, `ast`, `jsonTree`, `markdown`, `preview` and `runSheet`) are removed in 2.0.0. Use `renderer.outputs` (by output id), `renderer.formats` and `playground.output.views` / `inspect`

### Patch Changes

- **Playground**: The Recipe Studio drawer is fully translated, in English and French: the scheduling settings, the summary of each section, the explanation of every setting, the physical analysis and the list of serving times that do not work, and the serving time field is called "Serving time" ("Heure de service" in French).
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @gram-lang/renderer@1.4.0
  - @gram-lang/scheduler@1.4.0
  - @gram-lang/kitchen@1.4.0
  - @gram-lang/analyzer@1.4.0
  - @gram-lang/i18n@1.4.0
  - @gram-lang/modules@1.4.0
  - @gram-lang/parser@1.4.0

## 1.3.0

### Patch Changes

- Updated dependencies [4c9652c]
- Updated dependencies [a5891a9]
- Updated dependencies [48c856d]
- Updated dependencies [95698cc]
- Updated dependencies [fac320b]
  - @gram-lang/renderer@1.3.0
  - @gram-lang/modules@1.3.0
  - @gram-lang/analyzer@1.3.0
  - @gram-lang/parser@1.3.0
  - @gram-lang/kitchen@1.3.0
  - @gram-lang/i18n@1.3.0

## 1.2.1

### Patch Changes

- 532ea55: **Renderer**: Switched icons to embedded inline SVGs, removing external CDN dependencies (`unpkg.com`) and enabling full offline previews in VS Code.
- c8c4d49: **Documentation & Playground**: Improved accessibility and keyboard navigation across the website and interactive playground (ARIA roles, tab navigation, `prefers-reduced-motion`).
- Updated dependencies [532ea55]
- Updated dependencies [728e2ba]
- Updated dependencies [c8c4d49]
  - @gram-lang/renderer@1.2.1
  - @gram-lang/i18n@1.2.1
  - @gram-lang/analyzer@1.2.1
  - @gram-lang/kitchen@1.2.1
  - @gram-lang/modules@1.2.1
  - @gram-lang/parser@1.2.1

## 1.2.0

### Patch Changes

- Updated dependencies [9331a4b]
- Updated dependencies [c31a583]
- Updated dependencies [f617b4c]
- Updated dependencies [2bab3cd]
- Updated dependencies [8a4056b]
- Updated dependencies [aaf8cee]
  - @gram-lang/kitchen@1.2.0
  - @gram-lang/modules@1.2.0
  - @gram-lang/i18n@1.2.0
  - @gram-lang/parser@1.2.0
  - @gram-lang/renderer@1.2.0
  - @gram-lang/analyzer@1.2.0

## 1.1.0

### Patch Changes

- Updated dependencies [b3a509a]
- Updated dependencies [fbb7511]
- Updated dependencies [fbb7511]
- Updated dependencies [fbb7511]
  - @gram-lang/parser@1.1.0
  - @gram-lang/kitchen@1.1.0
  - @gram-lang/analyzer@1.1.0
  - @gram-lang/renderer@1.1.0
  - @gram-lang/i18n@1.1.0

## 1.0.1

### Patch Changes

- @gram-lang/analyzer@1.0.1
- @gram-lang/kitchen@1.0.1
- @gram-lang/parser@1.0.1
- @gram-lang/i18n@1.0.1
- @gram-lang/renderer@1.0.1
