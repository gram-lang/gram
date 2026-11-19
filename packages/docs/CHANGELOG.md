# @gram-lang/docs

## 1.5.0

### Minor Changes

- 9c86b70: **Scheduler, Renderer & CLI**: Clock times can now be entered and displayed in 12-hour (`1:00 PM`) as well as 24-hour (`13:00`) format:
  - `--available`, `--meal-times`, `--serve`, `--find`, their `availability` and `mealTimes` settings, and the editor's serving time accept 12-hour times in any case or spacing (`8am-10pm`, `fri=6pm-12am`, `12:30pm,8pm`, `"2026-10-11 1:00 pm"`), rejecting invalid forms like `13pm`, `0am`, or bare hours.
  - Adds a `clock` view setting (`auto`, `12h`, `24h`) controlling time formatting in the run sheet, serving-time suggestions, and iCalendar descriptions; `auto` (default) follows the reader's locale region rather than the recipe language.
  - Configurable via `--clock` (`gram plan`, `gram export`, `gram print`), `clock` in `.gram/config.yaml` (or global config), `gram.clock` in VS Code, and the playground's Display menu.
  - Adds `locale` support to `prepareViews()`, an `hourCycle` option to run sheets, clock helpers (`formatClock`, `chooseClock`, `resolveHourCycle`, `systemLocale`) in `@gram-lang/renderer`, and `parseTimeOfDay` / `parseLocalDateTime` in `@gram-lang/scheduler` (JSON and ISO data remain unchanged).
- fc13489: **Playground**: The playground now exposes the example ingredient database behind its weight and nutrition calculations:
  - Adds a read-only `ingredients.yaml` tab alongside recipe files, using the same format as a project database and linking to the database guide.
  - Missing-ingredient and missing-data warnings link directly to open the database tab.

### Patch Changes

- Updated dependencies [aa78c53]
- Updated dependencies [9c86b70]
- Updated dependencies [073d4f1]
- Updated dependencies [e0f8fbf]
- Updated dependencies [80fbc22]
- Updated dependencies [8d1b62e]
- Updated dependencies [7d15360]
- Updated dependencies [f4c6943]
- Updated dependencies [a9e6231]
- Updated dependencies [92bec33]
- Updated dependencies [f91ec4e]
- Updated dependencies [238e012]
- Updated dependencies [4d4b12e]
- Updated dependencies [0fa8c95]
- Updated dependencies [55188fc]
- Updated dependencies [d5fe9c3]
- Updated dependencies [4d5f79f]
  - @gram-lang/analyzer@1.5.0
  - @gram-lang/scheduler@1.5.0
  - @gram-lang/renderer@1.5.0
  - @gram-lang/parser@1.5.0
  - @gram-lang/kitchen@1.5.0
  - @gram-lang/i18n@1.5.0
  - @gram-lang/modules@1.5.0

## 1.4.2

### Patch Changes

- Updated dependencies [6620c24]
- Updated dependencies [3ecc785]
- Updated dependencies [229f017]
  - @gram-lang/parser@1.4.2
  - @gram-lang/kitchen@1.4.2
  - @gram-lang/renderer@1.4.2
  - @gram-lang/analyzer@1.4.2
  - @gram-lang/modules@1.4.2
  - @gram-lang/i18n@1.4.2
  - @gram-lang/scheduler@1.4.2

## 1.4.1

### Patch Changes

- Updated dependencies [2327de6]
- Updated dependencies [7de7b3f]
- Updated dependencies [7fbd5c6]
- Updated dependencies [2327de6]
- Updated dependencies [7fbd5c6]
- Updated dependencies [d946b46]
- Updated dependencies [4608f96]
- Updated dependencies [efbb381]
  - @gram-lang/renderer@1.4.1
  - @gram-lang/i18n@1.4.1
  - @gram-lang/analyzer@1.4.1
  - @gram-lang/parser@1.4.1
  - @gram-lang/kitchen@1.4.1
  - @gram-lang/modules@1.4.1
  - @gram-lang/scheduler@1.4.1

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
