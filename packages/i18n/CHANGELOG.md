# @gram-lang/i18n

## 1.4.0

### Minor Changes

- c653893: **Comments**: You can now choose whether the comments of a recipe (`// like this`) are shown or left out, in every view:

  - The renderer takes a new `comments: "show" | "hide"` option (default `"show"`): the recipe views, the print and the run sheet all follow it, and hiding leaves no empty notes section behind
  - `gram export`, `gram print` and `gram plan` accept `--comments <show|hide>`
  - A new `gram.comments` setting does the same for the VS Code preview and run sheet, and the playground gets a **Display** section with a switch
  - In the run sheet, comments are set apart discreetly: a note alone on a line sits under its step in small muted text, and one at the end of a line stays in the sentence, between parentheses

- 1639636: **I18n**: A new `fillTemplate(template, values)` fills the `{name}` placeholders of a dictionary string (`"Serve at {time}"` becomes `"Serve at 20:00"`), leaving a name with no value as written.
- 588328e: **Language Server**: Editors can now request only active views through a dedicated views protocol:

  - A client declaring `initializationOptions.views` specifies open recipe outputs via `gram/setOpenViews` and receives targeted updates in `gram/viewUpdated`: recipe and run sheet views as HTML, or AST and compiled JSON as text or interactive trees. Closed outputs are no longer evaluated
  - When a recipe encounters compilation errors, open outputs are paused rather than replaced by an error card: editors retain their last valid rendered view, while localized error summaries are provided alongside standard LSP diagnostics
  - `gram/setSession` configures transient session parameters for a recipe: target serving time (projecting the run sheet onto the calendar in the project's `timezone` and within its `availability`), scaling factor, pre-prepared imports in stock, and baker's percentage reference. Sessions are held per document in memory, while compiler diagnostics continue evaluating the recipe as written
  - The outputs a client can open are listed in the `initialize` result, each with its name in the editor's language and what it reads from the plan, so an editor shows a new view of Gram without an update of its own, and offers a serving time for any view laid out in time
  - A `gram/serveTimes` request gives the serving times to propose for a recipe, in words: those that work over the next seven days at the project's `mealTimes`, why the others do not, and the earliest one
  - A `gram/sessionChoices` request gives what session controls offer for a recipe as written: its ingredients, its `@use` imports (nested ones included), whether baker's math is on, and why the session's scale could not be applied
  - Editing `.gram/config.yaml` (its `timezone`, `availability` or `paths`) now updates the open recipes and their views right away, instead of at their next edit

  **Deprecated**

  - Language Server: the `gram/previewUpdated` notification, sent to clients that do not declare the views protocol, is deprecated and will be removed in 2.0.0. Adopt `gram/viewUpdated` with the `recipe` output instead (see the deprecations page of the docs)

- a20f506: **Playground**: The studio now offers every setting of a recipe and remembers them:

  - New options for the quantities in the steps and for the nutrition basis, the latter next to the nutrition estimation
  - Yield management and baker's percentages are now on by default, as on the command line and in the editor
  - Every setting is remembered in the browser, except the serving time, which belongs to the visit (the time zone and the kitchen hours are still remembered)
  - The Markdown output now follows the same settings as the preview, hidden weights included

- 067d607: **Playground**: The views of a recipe are now in front, and each one is shown in every format it has:

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

- b1a15f8: **Rendering**: Durations read more naturally, in the reader's language:

  - A duration of a day or more is written in days and hours, rounded to the hour: a recipe of 25 hours shows `1d 1h` (`1j 1h` in French) instead of `25h 6m`
  - The total time tooltip keeps hours and minutes and ends on the exact total (`= 25h 6min`), so its parts always add up and the rounded `1d 1h` of the pill reads as that same total
  - Minutes are written `min` instead of `m` (`1h 30min`, `45min`), and the units follow the display language in every view: recipe, run sheet, Markdown, text and print
  - `formatDuration()` takes the language as an optional second argument (`formatDuration(1506, "fr")` gives `1j 1h`) and `{ days: false }` as a third to keep hours and minutes; a new `durationUnits` entry of `@gram-lang/i18n` holds the units of each language
  - The time labels are in sentence case (`Total time`, `Temps total`), and the Markdown recipe puts the space French wants before the colon (`**Temps total** : 1j 1h`)
  - The total time hint in the editor, after the recipe's title, says the total as the views do, in the recipe's language

- dc6899d: **Rendering**: Modernized the HTML recipe view layout and visual design:

  - Clean header with recipe title, description, and metadata byline (author, date, clickable source, tags, and custom frontmatter attributes)
  - Compact hero bar for servings with interactive scaling controls, physical yield, and standardized net mass
  - The portions in the hero bar come with an icon and their word in the right singular or plural (`1 portion`, `4 portions`), and a scaled recipe shows its factor (`6 portions ×1.5`). What the recipe makes, weighs and brings (yield, mass, calories) stays together: on a narrow view it moves to a line of its own under the portions, instead of wrapping one item at a time
  - A page that can change the portions shows a small pencil button beside them, with a hover effect, by putting a `can-edit-portions` class around the recipe; the playground uses it to open its Portions & Scale settings. Without that class, as in an editor preview or an exported file, the button stays hidden
  - Every view now says "portions", the word of the `portions:` field, in English and French alike: the recipe, its text format and the run sheet no longer mix "servings" or "parts" with "portions"
  - Dedicated timings bar (`.recipe-timings-bar`) with interactive detailed breakdown tooltips
  - Recipe-level notes callout for frontmatter notes
  - Responsive grid layout with dot leaders for section ingredients and equipment, dynamically adapting from single column on narrow panels to multi-column layouts on wider viewports, aligning names on the left and quantities or standardized masses on the right with preparation notes underneath
  - Suppressed redundant ingredient quantity tooltips in inline step text when quantities are already visibly displayed next to the ingredient, reserving quantity tooltips for when inline step quantities are hidden (`hideStepQty`)
  - Tooltips of ingredients, intermediates and cookware in the steps are now small cards: the name with an "Optional" badge, then aligned rows for the quantity, the weight, the preparation and what a part is taken from (`Taken from: 6 eggs`). An estimated weight says how it was estimated (average density or unit weight), a weight already in grams is no longer repeated, cookware shows `×12`, and the "(alt)" badge lists each substitute with its own quantity
  - The printed recipe no longer carries any tooltip, since paper cannot show them
  - The printed recipe (`toPrintHTML`, `gram print`, `gram export --format html`) now looks like the one on screen, as the run sheet already did: the same header, timings and hero bar, the shopping list with boxes to tick and dot leaders, the ingredients of each section in a frame, numbered steps with outlined temperatures and filled timers, and the nutrition table, all in black and white for the page. The printed recipe and run sheet now use exactly the fonts of the screen, instead of a typewriter font, and the run sheet's title is no longer set in spaced-out capitals
  - Interactive intermediate ingredient traceability: what a step makes is written on its own line under the step (`↳ dough`), with bidirectional highlight/smooth scroll navigation when hovering or clicking references (`.reference[data-ref-id]` and `[data-declares]` producer steps or sections)
  - Ingredient and cookware highlighting: hovering an item in a section's list highlights the steps of that section where it is used, and hovering it in the shopping list highlights them across the whole recipe
  - Step completion checklist: clicking on a step number marks the step as completed (`.is-completed`) with a checkmark badge and softened opacity
  - Composite ingredients in the shopping list: one checkbox for the item you buy (eggs, lemons) with its count, and the parts the recipe uses (yolks, juice, the share used whole) listed underneath as small lines with their own quantities, instead of a "(Composite)" badge and a checkbox per part
  - Cookware shows how many you need right in the list (`pan ×2`), aligned like ingredient quantities, and nothing when you need just one
  - Footnote marks (`[1]`) stay on the line of the word they annotate instead of wrapping alone to the next line
  - In the steps of the recipe and the run sheet, on screen and on paper, a timer or a temperature keeps the punctuation written against it: the full stop after `30 min` or the parentheses around `200 °C` no longer wrap alone to the next line
  - Shopping list copy button: added a discreet copy button aligned with the shopping list section title with formatted clipboard export and visual confirmation feedback
  - Universal floating tooltip engine (`attachTooltips`, `TOOLTIP_SCRIPT`) with viewport-edge clamping and boundary collision prevention, suppressing duplicate tooltips across surfaces
  - Each view now has its own styles, kept to its own root element: the recipe is written in an `<article class="gram-recipe">` and the run sheet in a `<section class="gram-run-sheet">`. A style written for one view can no longer change another, and a view keeps its look wherever its HTML is placed, with or without a `.gram-preview` container around it
  - `@gram-lang/renderer/gram.css` is imported as before; the file itself is now built into the package's `dist/` folder, and the package lists its entry points (`exports`). It uses the CSS `@scope` rule, supported by every current browser
  - The run sheet no longer borrows the green dotted underline of the recipe's intermediates: they stay in the text color, like the rest of the sheet
  - The run sheet lists what to take out like the recipe does: as many columns as the space holds (one in a narrow editor pane or on a phone, two on a wide page), a long name wrapping instead of pushing its quantity off the line, and the preparation or "in stock" note written underneath the name

  **Deprecated**

  - Renderer: the `interactiveScaling` option of `toHTML()`, and the `decreasePortions`, `increasePortions` and `editPortions` strings of `@gram-lang/i18n`, removed in 2.0.0. The portions stepper they draw only works where the page around the recipe handles its buttons, so it did nothing in an exported file or an editor preview. Scale the recipe before rendering it instead (`applyScale()` of `@gram-lang/kitchen`): the recipe then shows its portions and its scale factor by itself. The option keeps working until 2.0.0

- 12e7460: **Rendering**: The mise en place can now be planned right before each section, all at the start, or at the start of each working day:

  - New `miseEnPlace` option (`"perSection"` by default, `"upfront"` or `"perDay"`) on the HTML, Markdown and print outputs, and a new `rests` option (`"shortest"` by default, `"balanced"` or `"longest"`) for the waits written as a range (`~_{12-24h}`)
  - The ingredient lists are the same in every mode: the recipe says how, and what to take out and when is the run sheet's
  - The total time follows the chosen schedule, and its tooltip explains how it adds up (preparation, active time and waits), then points to the run sheet for the hour-by-hour plan
  - The recipe no longer shows the waiting time on its own, in HTML, Markdown, text and print alike: it is counted in the total time, and the run sheet is where the waits are planned. The preparation and active times stay
  - The preparation tooltips follow the display language and the duration format you pass: no more space before the colon in English, no more fixed `1min`, and a preparation's duration is no longer shown twice

- dc6899d: **Nutrition & Rendering**: The nutrition of the HTML recipe is now a compact table, like a European food label, and easy to reach from the top of the recipe:

  - One column per basis, side by side (per 100 g, then per portion), with the energy as the first row in kJ and kcal and the whole recipe underneath; no more switching between bases
  - A `%RI` column gives each nutrient's share of the reference intake of an average adult (8,400 kJ / 2,000 kcal), per portion
  - The hero bar shows the energy (`493 kcal per portion`, or per 100 g when the recipe declares no portions); clicking it jumps to the table
  - Sodium is now shown as salt, in grams (sodium × 2.5), and calories as energy, in every view and every language: the HTML and printed recipe, Markdown, plain text and the terminal
  - With the `nutritionBasis` setting set to one basis, the table and the hero bar show that basis alone
  - The Markdown and plain text recipes show the same table by default (per 100 g and per portion side by side, the `%RI` column and the whole recipe underneath), instead of the values per portion only
  - **Deprecated**: the `interactiveNutrition` option of the renderer no longer has any effect, since every basis is shown at once. Remove it; it will be removed in 2.0.0

- 26171cc: **Rendering**: The recipe can now be written as plain text, for a terminal or a plain file:

  - A box with the title, the servings and the times, then the shopping list, the cookware, each section with its ingredients and its numbered steps, the notes and the nutrition, with the quantities lined up in a column
  - Every word is in the reader's language, and the text follows the same settings as the other formats (comments, quantities in the steps, baker's percentages, nutrition basis, mise en place and rests)
  - `gram export --format text` writes it next to the recipe (`brioche.txt`), and the playground offers it as a format of the recipe
  - The Markdown, HTML and print versions of the recipe now speak the reader's language too: "Instructions", "Ingredients", "Metadata", "Total Mass", "or", "optional", "passive" and the other words that were always in English now follow the language setting (`Étapes`, `Ingrédients`, `Métadonnées`, `ou`, `optionnel`... in French). The English output is unchanged, and the run sheet gets the same words
  - For developers: `toText()` and the `text` format of the recipe view; a `textStyle` option lets a terminal add its own colors, and `width` sets the width of the box and the rules

- c653893: **Rendering / Run sheet**: A new run sheet shows what the scheduler computed, and replaces the Gantt chart as the view of the schedule:

  - `runSheetToText`, `runSheetToMarkdown`, `runSheetToHTML` and `runSheetToPrintHTML` write the plan: the schedule of the days, then for each visit to the kitchen a worksheet in three parts: the mise en place (ingredients with their weight when the mass standardization is on, preparations made before, bases in stock, cookware with its count and size), the execution (the steps of each section, numbered as in the recipe, with their actions, temperatures and timers, and the time the section starts) and what to do on leaving (what goes on afterwards, and when to come back)
  - What to take out follows the mise en place mode of the plan: by section, each section is a station with its own things to take out, right before its steps (the cookware once, at the first section that uses it); per working day, everything the day needs is listed together, with the quantities summed, at the top of the day's first visit; upfront, all of them come out at the first visit. A preparation always comes out at the visit of the first step that uses it
  - Each visit says how early it could be done ("Possible from 18:00") or which wait holds it in place ("Can't start earlier: the “Fill” wait can't be longer than 2h and ends when you serve"), and a wait the plan stretched or shortened is reported on its day, with the range you wrote
  - A recipe with no serving time is told in days before the service (D-2, D-1, day D) and in durations; the HTML needs no script and the print document has one day per page (a long day runs over several pages, never cutting a step), with check boxes for the mise en place
  - `describeRunSheet()` gives the same plan in words, and `visitKit()`, `sectionProgram()` and `sectionSteps()` are the three pieces (what to take out, which steps a visit covers, the steps written out) that another interface can reuse; `describeServeTimes()` and `describeEarliestServe()` word the search of serving times
  - Recipe views focus solely on cooking instructions without schedule details: the run sheet is now rendered as its own distinct view

  **Deprecated**

  - Renderer: the Gantt chart (`toGanttHTML`, `attachGanttInteractivity`, `formatTime`, `formatAxisTime`, the `Gantt*` types), `@gram-lang/renderer/gantt.css` and the `gantt_*` strings of the playground, removed in 2.0.0. No Gram surface draws it any more. Use the run sheet (`runSheetToHTML`), or build a view of your own from the data of `runSheet()`; `toGanttHTML` warns once on the console. The Deprecated features page shows how: https://gram-lang.org/docs/how-to/deprecations/

  **Fixed**

  - The Gantt chart options `gapThresholdMinutes` and `compressedGapSize` now do what they describe, everywhere on the chart: `compressedGapSize` sets how wide a compressed wait is left, `gapThresholdMinutes` applies to the chart's width and the blocks' positions too, and a missing, `NaN` or negative value falls back on the default

- bdd85c5: **VS Code / Preview**: The **Scale and stock** section now lets you set the number of portions directly:

  - A new **Portions** field shows the portions the recipe is written for, and scales the recipe when you change it
  - The field only appears when the recipe states its portions

### Patch Changes

- b195eb3: **I18n**: Bilingual strings for the Recipe Studio drawer of the playground:

  - Labels for the scheduling settings, the section activity indicators and the explanatory tooltips of every setting
  - The summary of the schedule section is now fully translated: the serving time, custom hours, and the mise en place and waits chosen no longer show up in French on the English playground
  - Simplified section titles (Schedule, Quantities, Baker's percentages, Display, Nutrition and mass, Stocked bases) in English and French, and refreshed the onboard settings hint
  - The physical analysis summary and the list of serving times that don't work are translated too, and the serving time field is called "Serving time" ("Heure de service" in French)

## 1.3.0

### Minor Changes

- fac320b: **Parser & Kitchen**: Units written with abbreviation dots are now understood:

  - `{1/2 c.à.s}`, `{1 c. à c.}`, `{2 fl. oz.}` and similar spellings now parse and are recognized as the same unit as `càs`, `càc` or `fl oz`

  **Fixed**

  - **Parser**: A quantity in braces that can't be read (for example `@salt{1 g/l}` or a missing `}`) is now reported as an error pointing at the brace, instead of being ignored and merging the ingredient with others that share the same first word

## 1.2.1

### Patch Changes

- c8c4d49: **Documentation & Playground**: Improved accessibility and keyboard navigation across the website and interactive playground (ARIA roles, tab navigation, `prefers-reduced-motion`).

## 1.2.0

### Minor Changes

- 2bab3cd: **Parser & Kitchen**: Introduced modular recipes and multi-file imports via the `@use` directive:
  - Import external base recipes directly into a recipe using `@use "./bases/shortcrust-pastry.gram" as &shortcrust`.
  - Imported steps seamlessly interleave into the global ALAP scheduling timeline, preserving resting times and dependencies.
  - Automatically scales imported base quantities when referenced with specific yields (e.g. `&shortcrust{250g}` halves a 500 g base recipe).
  - Supports destructured multi-yield imports (e.g. `@use "./bases/tart-elements.gram" as { &crust, &frangipane }`) scaling each component independently.
  - Supports multi-word bindings using bracket notation (e.g. `@use "..." as &pastry dough{}`).
  - Resolves project-root paths (`@/bases/...`) and custom path aliases defined under `paths:` in `.gram/config.yaml`.
  - Added `--stock` CLI flag to treat pre-made base imports as stock items (zero timeline overhead, single shopping list line, retaining full nutritional totals).
  - Supports retro-planning timeline offsets directly on `@use` import lines (e.g. `@use "./bases/levain-starter.gram" as &starter ~{-2d}`).
  - Spliced sections in HTML, Markdown, and print outputs display origin badges crediting their source module.
  - `gram diff` and `gram watch` now track import additions, removals, rebinding, rescaling, and dependency file changes.
  - Language Server and VS Code extension support live dependency composition, Go to Definition into base files, path auto-completion, and quick-fix diagnostics for missing exports.
  - Exported `createMemoryHost` from `@gram-lang/modules` for browser and in-memory module graph resolution.
  - Corrected whole-recipe mass and nutrition totals to accurately include spliced intermediate (`-> &`) masses.
  - Normalized rescaled ingredient quantities to one decimal place for display consistency across all outputs.

### Patch Changes

- f617b4c: **Parser & Kitchen**: Improved clarity and tone for diagnostic messages and revised severity tiers:
  - Reworded compiler and module diagnostic messages to provide actionable guidance and avoid alarmist phrasing for standard culinary approximations.
  - Reclassified non-critical notices (`MISSING_MACROS`, `UNKNOWN_MASS`, `TRACK_CONTENTION`) to `info` severity so they do not clutter warning counters.
  - Enhanced Playground and editor diagnostic styling with dedicated color schemes for errors (red), warnings (amber), and notices (blue).
- 8a4056b: **Language Server**: Normalized error states and unified diagnostic handling across Playground and VSCode extensions:
  - Unified Playground diagnostics into a centralized full-width debug console with filter pills and interactive jump-to-location navigation.
  - Added mobile segmented tab navigation (`[Editor]` / `[Preview]`) and responsive single-row toolbar layout for mobile viewports.
  - Resolved nutrition diagnostics disconnection in the analyzer by merging physical and nutritional warnings into primary compiler warnings — the editor only turns these into squiggles when they carry a real position, so an incomplete-nutrition notice no longer misplaces itself at the top of the file.
  - Markdown and print HTML exports keep their explicit "incomplete data" note next to the affected nutrition figures; the interactive HTML preview conveys the same gap through its coverage badge instead.
  - A scale-target that fails to resolve (e.g. an unconvertible unit) now correctly turns the Playground's status badge and error panel red instead of being undersold as a warning, without marking the file tab as if the recipe itself had a syntax error.
  - The Playground diagnostics console no longer gets stuck filtered on a category that just emptied out (e.g. after fixing the warning it was showing).
  - Resolved silent compilation failures in the Language Server by capturing pipeline exceptions and pushing actionable error notifications to webviews — including when the thrown error carries no message, which previously slipped past the check silently.
  - A compile-time failure (parses fine, but `compile()`/`analyze()` throws) now also surfaces as an editor diagnostic, not only as a webview notification, so it's still visible with the preview panel closed.
  - Added bidirectional webview messaging in the VSCode extension to jump directly to error offsets in the active editor.
  - Localized the Playground diagnostics console's collapse/expand tooltip, previously hardcoded in French regardless of site locale.

## 1.1.0

### Minor Changes

- fbb7511: **Nutrition & Rendering**: Support flexible nutrition serving bases (per portion and per 100 g) alongside whole-recipe totals:
  - Declaring `portions:` in recipe frontmatter now calculates per-portion nutrition and keeps values constant when scaling recipes.
  - Added a standardized `per-100g` nutrition basis calculated from raw assembled recipe mass.
  - Added the `--nutrition <auto|total|per-portion|per-100g>` option to `gram view`, `gram export`, and `gram print`.
  - Added nutrition basis toggles in the web playground and VS Code live preview.
  - Localized all nutrient names and table headers across supported languages (French and English).

## 1.0.1

## 1.0.0

### Major Changes

- Gram v1.0.0 Official Launch! 🎉

  This milestone release marks the official 1.0.0 launch of Gram:

  - **Brand-New Website & Documentation**: Rebuilt using Astro and Starlight with refined guides and an integrated blog.
  - **Refreshed Visual Identity**: Brand-new logo.
  - **Infrastructure & Stability**: Monorepo stability, test coverage, and migration to self-hosted Forgejo (`git.gram-lang.org`) mirrored to GitHub and Codeberg.

## 1.0.0-beta.5

### Minor Changes

- b1aa8db: `@gram-lang/i18n` now also owns the numeric conversion factors for units (grams, milliliters, etc.) and time (minutes, hours, etc.), exported as `UNIT_CONVERSIONS` and `TIME_TO_MINUTES` — previously split across `@gram-lang/analyzer` and hardcoded inside `@gram-lang/kitchen`. No behavior changes; this just puts everything about units and time in one place.
- 79d835c: Food categories now have stable, language-independent keys (`CATEGORY_KEYS`, `CategoryKey`, `getCategoryLabels`, `isCategoryKey`) instead of only translated display labels. This means `gram db enrich` now stores a category identity that stays consistent regardless of your configured language, rather than a French or English label baked in at write time.

### Patch Changes

- 68a2a45: Fixed several French unit words silently resolving to the wrong physical quantity:

  - `quart`/`quarts` no longer resolves to the US liquid quart (946 mL) in French recipes — it's a false friend ("un quart d'heure" means "a quarter of an hour", not a unit of volume). It's now reported as an unknown unit instead of silently misinterpreted. The English word `quart`/`quarts` still works in English recipes; only the spelled-out alias was removed, `qt` still works everywhere.
  - `livre` now converts using the French "livre métrique" (500 g) instead of being silently treated as the imperial pound (453.592 g) — a ~10% error.
  - `tasse` now converts using the French cup (250 mL) instead of being silently treated as the US cup (236.588 mL) — a ~6% error.
  - `pinte` no longer resolves at all: the historical French pinte has no single reliable modern value, so an explicit "unknown unit" is better than a confident-looking wrong number.
  - `gallon`/`gallons` now resolve correctly (previously only the abbreviation `gal` worked).

## 1.0.0-beta.4

### Minor Changes

- 68365c4: Section retro-planning (e.g. `## Section ~{-2h}`) now enforces a strict signed-duration syntax instead of accepting arbitrary free text, preventing invalid timeline calculations. Added support for the `d` (day) time unit.

### Patch Changes

- fc47a86: Renamed the `cookTime` metric to `idleTime` across the ecosystem to better reflect hands-off wait time. Additionally, passive timers sharing the same name are now automatically sequenced one after another on the same background track.
- 55430e4: Added detailed per-contribution time breakdowns (Active, Prep, Total) to compiled recipe metrics, and surfaced them as explanatory tooltips on the time summary badges in the HTML renderer.

## 1.0.0-beta.3

### Patch Changes

- Updated deployment configuration to automate npmjs packages publication

## 1.0.0-beta.2

### Minor Changes

- a46c24f: Upgraded all monorepo dependencies to their latest versions and implemented a TypeScript 7 dual setup for faster typechecking while preserving compilation toolchain compatibility. Fixed type errors arising from Node 26 and VS Code LSP v10 updates.

### Patch Changes

- f5f1efe: chore: declare `sideEffects: false` so bundlers can tree-shake unused exports from these packages

  No package previously declared this, so third-party bundlers had to assume every module might have side effects and couldn't safely drop unused code.

## 1.0.0-beta.1

### Minor Changes

- a244341: Major overhaul of the documentation and playground infrastructure:

  - **Documentation Rewrite & i18n**: The documentation has been completely rewritten, thoroughly verified, and is now fully translated into French (in addition to the English version).
  - **Advanced Vue 3 Playground**: The legacy playground has been removed and rebuilt from the ground up using Vue 3. This new version is directly integrated into the documentation and introduces powerful new features, including recipe scaling and baker's math.

## 1.0.0-beta.0

### Major Changes

- 2dcd766: Introduction of the official GRAM CLI (`@gram-lang/cli`), a comprehensive command-line tool to manage, compile, and interact with your recipes.

  **Project & Recipe Management:**

  - **Project Setup**: `gram init` safely scaffolds a `.gram` environment, including interactive AI provider setup (Google, OpenAI, Anthropic, Ollama) and secret management.
  - **Automated Import**: `gram import` scrapes recipes from any URL and uses AI to flawlessly translate and convert them into native `.gram` syntax.
  - **Validation & Compilation**: `gram check` instantly validates syntax and database integrity. `gram build` compiles recipes to robust JSON with full physical and nutritional enrichment.
  - **Smart Scaling & Diff**: `gram scale` dynamically resizes recipes (e.g., `--scale flour=300g`) with a visual before/after comparison. `gram diff` provides a semantic "git diff" for cooking, tracking changes in quantities, timings, and steps.
  - **Export & Print**: `gram print` generates a beautifully typeset A4 HTML recipe card. `gram export` converts recipes to clean Markdown or static HTML.
  - **Auto-formatting & Watcher**: `gram format` automatically enforces `.gram` language styling standards. `gram watch` provides real-time validation upon saving.

  **Interactive Cooking & Daily Use:**

  - **Terminal Cooking Assistant (`gram cook`)**: A step-by-step interactive TUI (Terminal User Interface) that guides you through the recipe, featuring a dynamic ingredient checklist and live background timers.
  - **Smart Shopping List (`gram shop`)**: Aggregates ingredients across multiple recipes, automatically converting volumes to masses and sorting them by supermarket aisle.
  - **Recipe Search (`gram suggest`)**: An alias-aware search engine to find recipes based on your available ingredients (e.g., `--with "butter, eggs" --without "milk"`).
  - **Rich Terminal Preview (`gram view`)**: Renders recipes directly in the terminal with color coding, active timers, and nutritional tables.

  **AI-Powered Database Management (`gram db`):**

  - **Smart Database Sync & Enrichment**: `gram db sync` automatically tracks new ingredients across your project. `gram db enrich` uses AI to automatically fill in missing densities, unit weights, categories, and nutrition facts.
  - **Semantic Linting & Conflict Resolution**: `gram db lint` uses AI to detect plural mistakes and semantic duplicates (e.g., `scallion` vs `green onion`). `gram db merge` handles conflicts when integrating external community databases.

### Minor Changes

- 79105ce: Complete overhaul of the VS Code Extension with Language Server, Live Preview, and advanced assistance

  **Major New Features:**

  - **Full Language Server (LSP)**: The extension now ships with a complete language server. All advanced features activate instantly upon opening a `.gram` file.
  - **Dynamic Live Preview**: A side-by-side WebView panel displaying the real-time HTML render of the recipe as you type.
    - Gracefully handles syntax errors via a visual fallback.
    - Integrates the official Playground styles for perfect consistency.
  - **CodeLens & Inlay Hints**:
    - **Inlay Hints**: Displays the cumulative total time in gray next to section titles.
    - **CodeLens**: Clickable buttons `▶ Preview` and `📊 Macros` above the main recipe title for quick access.

  **Ingredient Database & Nutrition:**

  - **Automatic Loading**: Automatically detects and loads `.gram/ingredients.yaml` from the workspace root (or via the path configured in `gram.ingredientDatabase.path` settings). Optimized indexing (O(1)) for maximum performance.
  - **Seamless Plural Management**: The extension silently handles plurals (e.g., `@carrots{3}` will automatically match `carrot`). No error diagnostics are raised, everything is transparent.
  - **Nutritional Hover & Macros Panel**:
    - Hovering over an ingredient displays a complete nutritional table (calories, proteins, carbs, fats, etc.).
    - The Live Preview integrates a Macros panel (hidden by default) that can be shown via CodeLens, featuring clear visual alerts for ingredients missing data.
  - **Fuzzy Matching "Did you mean?"**: Levenshtein algorithm (distance ≤ 2) suggests corrections if an ingredient is misspelled (e.g., `@tomaato` suggests `@tomato`). Directly integrated into Quick Fix code actions.
  - **On-Hover Unit Conversion**: Automatically converts volumes (ml, tbsp, etc.) to grams when hovering over an ingredient if its density is known in the database.

  **Editing Assistance & Navigation:**

  - **Advanced Contextual Autocompletion**:
    - After `@`: Suggests ingredients and their aliases from the YAML database. Automatically adds curly braces `{}` for multi-word names.
    - After `&`: Suggests only the existing intermediate declarations in the document.
    - Inside `{}`: Suggests canonical units (mass, volume, time) and their aliases (French/English) as soon as a digit is typed.
  - **Smart Navigation**:
    - **Go to Definition** (`Ctrl+Click` / `F12`) on a `&ref` reference to jump to its `->&ref` declaration.
    - **Find All References** (`Shift+F12`) to list all usages of an intermediate.
    - **Rename Symbol** (`F2`) to atomically rename an intermediate (declaration + references).
    - **Outline Panel** showing the hierarchy of sections and elements, with foldable code in the gutter.
  - **Intermediate Hover**: Displays the full text of the step where the intermediate was created.

  **Diagnostics & Code Actions (Quick Fixes):**

  - **Real-Time Diagnostics**:
    - Red underline for an orphaned `&ref` reference.
    - Warning for an unused `->&ref` declaration.
    - Warning if the frontmatter (title) is missing.
  - **Code Actions (💡)**:
    - _Quick Fix_: Insert the missing `title:` in the frontmatter.
    - _Quick Fix_: Remove an unused intermediate declaration.
    - _Quick Fix_: Declare a missing intermediate for an existing reference.
    - _Refactor_: Convert a volume quantity to mass directly in the code.
    - _Refactor_: Replace a misspelled ingredient with the closest Fuzzy match suggestion.

  **Semantic Highlighting, Formatting & Snippets:**

  - **Semantic Tokens**: Regex-based syntax highlighting (TextMate) is replaced by **AST-driven** highlighting. Offers surgical precision for ingredients, timers, temperatures, comments, and nested units (e.g., precise separation of value and unit in `{10g}`).
  - **Auto-formatting (`Alt+Shift+F`)**:
    - Normalization of spaces inside curly braces (`{ 200 g }` → `{200g}`).
    - Normalization of composite ingredients (`@a < @b` → `@a<@b`).
    - Alignment of section titles and tab-to-space conversions.
  - **Built-in Snippets**: Keyboard shortcuts for the basic structure (frontmatter, sections, steps), ingredient variants (`@ing`, `@?`, `@-`), cookware (`#cw`), and timers/temperatures.

- caf1630: Major architecture refactoring, ESM Migration, performance optimizations and code cleanup

## 0.10.1

### Patch Changes

- Cleaned up and updated dependencies.
- Implemented Turborepo to optimize and simplify project building.

## 0.10.0

### Minor Changes

- cfda9e1: Refactored unit translation and normalization into a new centralized @gram-lang/i18n package to remove redundancy between the compiler and analyzer.

### Patch Changes

- 3720644: Added Zod to automatically catch invalid data and prevent crashes.
