# @gram-lang/renderer

## 1.4.0

### Minor Changes

- c653893: **Comments**: You can now choose whether the comments of a recipe (`// like this`) are shown or left out, in every view:

  - The renderer takes a new `comments: "show" | "hide"` option (default `"show"`): the recipe views, the print and the run sheet all follow it, and hiding leaves no empty notes section behind
  - `gram export`, `gram print` and `gram plan` accept `--comments <show|hide>`
  - A new `gram.comments` setting does the same for the VS Code preview and run sheet, and the playground gets a **Display** section with a switch
  - In the run sheet, comments are set apart discreetly: a note alone on a line sits under its step in small muted text, and one at the end of a line stays in the sentence, between parentheses

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

- 523a241: **Renderer / Views**: A new `prepareViews()` gathers everything a view of a recipe is built from, worked out once and only when a view asks for it:

  - the timeline for the chosen settings and its total and idle times, the same at any serving time
  - the run sheet, on the calendar when a serving time is given, otherwise in days before the service
  - the serving time search (the earliest serving time, and the times worth proposing in a range) from your kitchen's time zone and hours; `suggestServeTimes()` puts it in words for a serving time field: the times that work over the next days, why the others do not, and the earliest
  - `views` lists the views of a recipe (the recipe, the run sheet) with the formats each one offers, the settings it follows and what it needs worked out, and `render(view, input, format)` writes one of them from what `prepareViews()` gave; it returns `null` for a run sheet when the recipe has no tasks. `toHTML`, `runSheetToHTML` and the other functions stay as they are
  - `inspectors` lists the looks at the pipeline (the composed AST as an S-expression, the analyzed recipe as JSON or as a tree that folds), and `outputs` lists the views and the inspectors together, for an interface that offers both. `renderJsonTree()` writes any data as that tree, with no script (native folding, keyboard included), and `JSON_TREE_CSS` styles it with colors you set through CSS variables; `renderSExpr()` writes an AST as an S-expression
  - `describeError()` picks the error to show when a recipe stops compiling (a blocking error first, then the first error) and gives its code, message, file and position, with a title in the recipe's language, so every interface reports the same error the same way

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

- 879594d: **Renderer / Settings**: The renderer now describes, in one place, every setting a reader can choose about a recipe, so that tools built on Gram can offer the same choices as the command line, the editor and the playground:

  - `VIEW_SETTINGS` lists what the views show (mise en place, rests, comments, nutrition basis, baker's percentages only, quantities in the steps) and `RECIPE_SETTINGS` what the analyzer computes (baker's percentages, weights in grams, preparation losses, nutrition), each with its values, its default and a short description
  - `parseViewSettings()` and `parseRecipeSettings()` read them from any configuration object, and fall back on the default for anything missing or unknown, so a mistyped setting never blanks a view
  - `viewSettingsToRendererOptions()` and `recipeSettingsToAnalyzerOptions()` turn them into the options of the renderer and of the analyzer

- a20f506: **Rendering**: Quantities read the same in every format, on screen and on paper:

  - The HTML views and the print now write the quantity after its ingredient in the text of each step, as Markdown already did, so a printed recipe shows them too; the tooltip stays on screen
  - The weight in grams is written next to the quantity as written in the recipe whenever it tells something more, in the ingredient lists and in the steps alike: `flour (250 ml, ~148 g)`, but `sugar (100 g)` with no repeated badge
  - Markdown now shows these weights in grams too
  - Hiding the quantities of the steps (`hideStepQty`) now works in the HTML views and the print, not only in Markdown

### Patch Changes

- dc6899d: **Renderer**: Improved Markdown recipe output formatting:

  - Fixed missing blank line between the notes / footnotes section and the nutrition heading
  - Removed emoji prefixes from section headings (`Shopping List`, `Cookware`, `Instructions`, `Nutrition`) and alerts for cleaner document rendering

- 32ba341: **Rendering**: Temperatures in the Markdown recipe now show a thermometer (`🌡️ 180 °C`, `🌡️ fridge`) instead of a flame, which read oddly for something cold, with a space between the icon and the value.
- c653893: **Run sheet**: Fixed the run sheet in "All at the start" and "Per day" modes, so each visit and each day now shows what is really done:
  - A visit is named after the sections cooked in it, no longer after a section whose equipment is only taken out there (for example "Baking" no longer appears on the day the batter is made)
  - Without a serving time, a visit after a long rest now falls on its own day (for example D-1 for the batter and Day D for the baking), as it does with a serving time
  - Scheduler: each visit now also lists the sections it cooks (`worked`), and `visitSections()` gives the sections to name a visit after
- Updated dependencies [9737e58]
- Updated dependencies [c653893]
- Updated dependencies [1639636]
- Updated dependencies [9c6f1af]
- Updated dependencies [62b6223]
- Updated dependencies [e5694b0]
- Updated dependencies [c653893]
- Updated dependencies [588328e]
- Updated dependencies [c653893]
- Updated dependencies [a20f506]
- Updated dependencies [067d607]
- Updated dependencies [b195eb3]
- Updated dependencies [b1a15f8]
- Updated dependencies [dc6899d]
- Updated dependencies [12e7460]
- Updated dependencies [dc6899d]
- Updated dependencies [26171cc]
- Updated dependencies [c653893]
- Updated dependencies [c653893]
- Updated dependencies [c156d56]
- Updated dependencies [bdd85c5]
  - @gram-lang/analyzer@1.4.0
  - @gram-lang/i18n@1.4.0
  - @gram-lang/kitchen@1.4.0
  - @gram-lang/scheduler@1.4.0
  - @gram-lang/parser@1.4.0

## 1.3.0

### Patch Changes

- 4c9652c: **CLI / View**: Fixed several display issues in `gram view` and cook mode:

  - Timers now show their real unit (`~{1h}` is shown as `~1h`, `~{20s}` as `~20s`) instead of always "min".
  - Recipe durations are rounded and readable (`1h 5m`, `25m 5s`) instead of raw decimals like `1h4.5`.
  - The resting time now appears in the recipe header.
  - Common fractions such as `1/4 tsp` stay fractions in the shopping list instead of becoming `0.3`.

- 95698cc: **Modules & Rendering**: Intermediates declared inside imported modules now show the name you wrote (for example `pressed`) instead of an internal path like `tofu$marinated$pressed`, in `gram view`, HTML and Markdown output.
- Updated dependencies [48c856d]
- Updated dependencies [95698cc]
- Updated dependencies [fac320b]
  - @gram-lang/analyzer@1.3.0
  - @gram-lang/parser@1.3.0
  - @gram-lang/kitchen@1.3.0
  - @gram-lang/i18n@1.3.0

## 1.2.1

### Patch Changes

- 532ea55: **Renderer**: Switched icons to embedded inline SVGs, removing external CDN dependencies (`unpkg.com`) and enabling full offline previews in VS Code.
- 728e2ba: **CLI / Export**: Fixed missing ingredient quantities in `gram print` and HTML exports (`gram export --format html`).
- Updated dependencies [c8c4d49]
  - @gram-lang/i18n@1.2.1
  - @gram-lang/analyzer@1.2.1
  - @gram-lang/kitchen@1.2.1
  - @gram-lang/parser@1.2.1

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
- Updated dependencies [9331a4b]
- Updated dependencies [c31a583]
- Updated dependencies [f617b4c]
- Updated dependencies [2bab3cd]
- Updated dependencies [8a4056b]
- Updated dependencies [aaf8cee]
  - @gram-lang/kitchen@1.2.0
  - @gram-lang/i18n@1.2.0
  - @gram-lang/parser@1.2.0
  - @gram-lang/analyzer@1.2.0

## 1.1.0

### Minor Changes

- fbb7511: **Nutrition & Rendering**: Support flexible nutrition serving bases (per portion and per 100 g) alongside whole-recipe totals:
  - Declaring `portions:` in recipe frontmatter now calculates per-portion nutrition and keeps values constant when scaling recipes.
  - Added a standardized `per-100g` nutrition basis calculated from raw assembled recipe mass.
  - Added the `--nutrition <auto|total|per-portion|per-100g>` option to `gram view`, `gram export`, and `gram print`.
  - Added nutrition basis toggles in the web playground and VS Code live preview.
  - Localized all nutrient names and table headers across supported languages (French and English).

### Patch Changes

- Updated dependencies [b3a509a]
- Updated dependencies [fbb7511]
- Updated dependencies [fbb7511]
- Updated dependencies [fbb7511]
  - @gram-lang/parser@1.1.0
  - @gram-lang/kitchen@1.1.0
  - @gram-lang/analyzer@1.1.0
  - @gram-lang/i18n@1.1.0

## 1.0.1

### Patch Changes

- @gram-lang/analyzer@1.0.1
- @gram-lang/kitchen@1.0.1
- @gram-lang/parser@1.0.1
- @gram-lang/i18n@1.0.1

## 1.0.0

### Major Changes

- Gram v1.0.0 Official Launch! 🎉

  This milestone release marks the official 1.0.0 launch of Gram:

  - **Brand-New Website & Documentation**: Rebuilt using Astro and Starlight with refined guides and an integrated blog.
  - **Refreshed Visual Identity**: Brand-new logo.
  - **Infrastructure & Stability**: Monorepo stability, test coverage, and migration to self-hosted Forgejo (`git.gram-lang.org`) mirrored to GitHub and Codeberg.

## 1.0.0-beta.5

### Minor Changes

- 2ed4707: The Markdown, HTML, and printable/PDF outputs now show the same information consistently:

  - Markdown recipes now include a nutrition summary (calories, carbs, protein, fat, etc.), which was previously only shown in HTML and print.
  - Recipe comments now appear as numbered footnotes in Markdown and print output too, instead of only in HTML.
  - When a shopping-list ingredient's purchasing weight differs from what actually goes in the bowl (e.g. "1 avocado" vs. its usable flesh), Markdown and print now show the extra "gross weight" note, matching HTML.
  - When the same ingredient appears in incompatible units that can't be combined (e.g. "100g" and "1 cup" with no density available), Markdown and print now group them together with a "mixed units" warning, matching HTML.

- 938afcd: Add an interactive Gantt Chart view to the VS Code extension and export reusable Gantt chart rendering helpers (`toGanttHTML`, `attachGanttInteractivity`) from `@gram-lang/renderer`. Provides a real-time timeline visualization of recipe steps, background timers, and target serving times directly in your editor and the web playground.

### Patch Changes

- 7b246ae: Removed all uses of `any` from the physical/nutrition analysis layer's internal types, typing them against the real shapes already exported by `@gram-lang/kitchen` and this package's own `AnalyzedUsage`/`NutritionItem`. No behavior change for this package beyond the fixes already released separately (see the relative-quantity type changeset). The renderer's printable/PDF view gained one internal `any` to stay compatible with the analyzer's now-stricter shopping-list type — purely a type-level adjustment, no output change.
- 19a9f19: The `hideStepQty` rendering option (hides ingredient quantities from step text) now works with `toHTML` and `toMarkdown`, not just `toPrintHTML` — it was previously silently ignored by the other two.
- 73fde5e: Fixed an HTML injection vulnerability (XSS) in `toHTML`'s timing-card tooltips: a section title or named timer containing HTML would render unescaped in the "Active Time" / "Total Time" tooltips, exploitable via the playground or the VS Code preview. Both are now properly escaped like every other text field.
- 3fae598: `toHTML`, `toMarkdown`, and `toPrintHTML` now type their `data` parameter instead of accepting `any`. Typing it surfaced two real bugs, now fixed: the HTML nutrition panel's "incomplete data" warning was never actually shown (it read a field that never existed, always showing a blank 0-calorie panel instead), and the printable/PDF view displayed sodium in grams instead of milligrams (1000x too high).
- a55dca8: `toMarkdown` now neutralizes raw HTML (`<` and `&`) in recipe titles, ingredient names, and step text. Previously, a recipe containing something like `<img onerror=...>` in its title would pass through untouched, which could run as a script if that Markdown was later converted to HTML — this is now escaped automatically, closing that gap for imported or shared recipes.
- d61d786: `QuantityValueAST` (the parser's internal representation of a parsed number/fraction/range) is now a proper discriminated union instead of a flat interface with every field optional. This is an internal type-safety improvement with no behavior change — it's what would have caught, at compile time, a real bug fixed earlier in `diffRecipes` (checking `qty.from`/`qty.to`, fields that never existed on any variant).
- Updated dependencies [b1aa8db]
- Updated dependencies [3afd970]
- Updated dependencies [8f7e887]
- Updated dependencies [5194ba4]
- Updated dependencies [1d86e74]
- Updated dependencies [7b246ae]
- Updated dependencies [f147b25]
- Updated dependencies [9553678]
- Updated dependencies [68a2a45]
- Updated dependencies [7c83cf8]
- Updated dependencies [dcaadd7]
- Updated dependencies [0c2e818]
- Updated dependencies [943e9f8]
- Updated dependencies [24a108c]
- Updated dependencies [970c32b]
- Updated dependencies [23e4286]
- Updated dependencies [901e90e]
- Updated dependencies [064ba9f]
- Updated dependencies [b1aa8db]
- Updated dependencies [79d835c]
- Updated dependencies [d61d786]
  - @gram-lang/analyzer@1.0.0-beta.5
  - @gram-lang/parser@1.0.0-beta.5
  - @gram-lang/i18n@1.0.0-beta.5
  - @gram-lang/kitchen@1.0.0-beta.5

## 1.0.0-beta.4

### Major Changes

- 68365c4: Section retro-planning (e.g. `## Section ~{-2h}`) now enforces a strict signed-duration syntax instead of accepting arbitrary free text, preventing invalid timeline calculations. Added support for the `d` (day) time unit.

### Patch Changes

- 7487b09: Fixed the display of alternative ingredient and cookware groups (`@egg|@tofu`). They now correctly render inline as a single joined line in shopping and section lists, rather than being dropped or rendered as oddly-wrapped sub-lists.
- 0bee2b2: Added support for bare single-word children in composite ingredients (e.g., `@juice<@lemon`), and allowed independent preparation instructions on the parent side. Fixed section ingredient lists silently dropping the parent reference.
- cb6b794: Fixed an issue where scaled fractions resulting in values below 1 (e.g., `0.5`) were rendered as raw decimals instead of common fractions (e.g., `1/2`) in the section ingredient list.
- fc47a86: Renamed the `cookTime` metric to `idleTime` across the ecosystem to better reflect hands-off wait time. Additionally, passive timers sharing the same name are now automatically sequenced one after another on the same background track.
- b546f96: Fixed shopping list ingredient names defaulting to the database's canonical wording when the recipe used a valid alias. The lists now correctly preserve the recipe's original wording or translated alias, ensuring consistent language throughout.
- 55430e4: Added detailed per-contribution time breakdowns (Active, Prep, Total) to compiled recipe metrics, and surfaced them as explanatory tooltips on the time summary badges in the HTML renderer.
- Updated dependencies [06039f2]
- Updated dependencies [7487b09]
- Updated dependencies [0bee2b2]
- Updated dependencies [e659677]
- Updated dependencies [aa0c082]
- Updated dependencies [fc47a86]
- Updated dependencies [68365c4]
- Updated dependencies [c1c9b53]
- Updated dependencies [68365c4]
- Updated dependencies [55430e4]
  - @gram-lang/kitchen@1.0.0-beta.4
  - @gram-lang/parser@1.0.0-beta.4
  - @gram-lang/i18n@1.0.0-beta.4

## 1.0.0-beta.3

### Patch Changes

- Updated deployment configuration to automate npmjs packages publication
- Updated dependencies
  - @gram-lang/i18n@1.0.0-beta.3
  - @gram-lang/kitchen@1.0.0-beta.3
  - @gram-lang/parser@1.0.0-beta.3

## 1.0.0-beta.2

### Minor Changes

- 8fca04c: `toHTML` no longer stamps footnote anchor ids with `Math.random()`. Output is now deterministic by default (ids like `note-1`), which is required for byte-stable golden/conformance testing. If you render multiple recipes on the same page and relied on random ids to avoid anchor collisions, pass a new `renderId` option (e.g. a recipe slug) to disambiguate.
- a46c24f: Upgraded all monorepo dependencies to their latest versions and implemented a TypeScript 7 dual setup for faster typechecking while preserving compilation toolchain compatibility. Fixed type errors arising from Node 26 and VS Code LSP v10 updates.

### Patch Changes

- 0aec389: Fix `_usageId` leaking a global counter across separate `compile()` calls in the same
  process (affected the language server and `gram scale`'s parallel compiles, making ids
  non-deterministic for an unchanged recipe). Fix nutrition analysis always reporting
  `isEstimate: true` regardless of actual data precision. Fix the section mass badge in
  HTML output missing its scale icon.
- f5f1efe: chore: declare `sideEffects: false` so bundlers can tree-shake unused exports from these packages

  No package previously declared this, so third-party bundlers had to assume every module might have side effects and couldn't safely drop unused code.

- 0ccfc99: Compiler warnings (`CompilationResult.warnings`, `NutritionMetrics.warnings`) are now
  always structured `Warning` objects (`{ code, message, item?, loc?, section? }`) instead
  of sometimes being plain strings depending on call order — a latent inconsistency that
  could previously produce `"[object Object]"` in some rendered output. `Usage.composite`,
  `Usage.options`, and `ProcessedStep.content` are now properly typed instead of `any`.
  Also fixes range-based timer quantities (e.g. `~{5-10min}`) never displaying correctly
  in `gram diff` output, due to a pre-existing typo checking non-existent fields.
- Updated dependencies [0aec389]
- Updated dependencies [e192fe2]
- Updated dependencies [404198a]
- Updated dependencies [d837da3]
- Updated dependencies [f5f1efe]
- Updated dependencies [8dc9c60]
- Updated dependencies [6eab9b3]
- Updated dependencies [e55940f]
- Updated dependencies [a46c24f]
- Updated dependencies [0ccfc99]
  - @gram-lang/kitchen@1.0.0-beta.2
  - @gram-lang/parser@1.0.0-beta.2
  - @gram-lang/i18n@1.0.0-beta.2

## 1.0.0-beta.1

### Major Changes

- a1e6fe9: refactor: rename `isAsync` to `isPassive` to align with domain terminology

  To better align the codebase with the actual domain model of a kitchen, the "asynchronous" timer concept has been completely renamed to "passive". This introduces the following breaking changes for tool builders:

  - **AST**: The `TimerAST` node property `isAsync: boolean` is now `isPassive: boolean`.
  - **CSS**: The `.timer.async` class generated by the renderer has been renamed to `.timer.passive`.
  - **Kitchen Metrics**: All internal variables and comments referring to `async` background tasks have been updated to `passive`.

### Minor Changes

- a244341: Major overhaul of the documentation and playground infrastructure:

  - **Documentation Rewrite & i18n**: The documentation has been completely rewritten, thoroughly verified, and is now fully translated into French (in addition to the English version).
  - **Advanced Vue 3 Playground**: The legacy playground has been removed and rebuilt from the ground up using Vue 3. This new version is directly integrated into the documentation and introduces powerful new features, including recipe scaling and baker's math.

- 8921d9d: Fixed several correctness bugs found during a documentation audit, and added alias-aware cross-unit shopping list aggregation.

  - **@gram-lang/analyzer**: `unit_weight`-based conversions (e.g. `@avocado{1}`) were being double-divided by `yield` — the whole-unit weight is now correctly treated as Gross Mass, with Net Mass derived forward (`Gross × yield`), while explicit mass/volume entries keep deriving Gross backward (`Net ÷ yield`) as before. Optional ingredients (`?`) are no longer counted in nutrition totals. New `resolveCanonicalId()` resolves an ingredient name/alias to its database key, and a new `aggregateShoppingList()` step re-groups the shopping list by canonical id — merging aliased ingredients (e.g. `beurre`/`butter`) and cross-unit quantities (e.g. `100g` + `1 cup`) into a single gram total whenever every entry resolves to a mass, falling back to separate entries flagged `multiUnit: true` when a density is missing.
  - **@gram-lang/renderer**: The HTML shopping list now clusters consecutive `multiUnit`-flagged entries for the same ingredient under one heading with a "⚠️ Mixed units" badge, instead of listing them as unrelated lines.
  - **@gram-lang/cli**: `shopper`'s alias resolution now reuses `@gram-lang/analyzer`'s `resolveCanonicalId()` instead of a separate, duplicated alias map.

- fbe648e: Improve ingredient preparation tracking and display.

  - **Kitchen**: `aggregateSectionIngredients` now groups ingredients by both `id` and `preparation`, creating separate entries for the same ingredient if it requires different preparations (e.g. cold vs melted).
  - **Renderer**: A new `formatMode` option in the render context controls preparation rendering. Preparations remain visible in inline text to prevent information loss. In the section's ingredient list (Mise-en-place), they are cleanly displayed with an em-dash. In the global shopping list, they remain hidden.

- 2476140: Added a centralized `ScaleEngine` in `@gram-lang/kitchen` to make recipe scaling (`--scale`) and Baker's Percentage math safer and more consistent everywhere.

  - **@gram-lang/kitchen**: New `resolveScaleFactor()`/`applyScale()` API validates a `--scale` target before computing a factor — rejecting fixed (`@=`) ingredients, relative quantities, ingredients only used inside a sub-recipe, ingredients inside an alternative-ingredient group, and ingredients split across incompatible units, with a clear error instead of a silently wrong number. A sub-recipe's own total (e.g. "2 lemons") is itself a valid scale target. Scaling is now a pure operation (never mutates the original recipe), and the compiled recipe now carries an explicit `scaleFactor` field. Covered by a new unit test suite.
  - **@gram-lang/analyzer**: Fixed the `@*` Baker's-reference auto-detection (it silently never matched before), and it now refuses to use a relative-quantity ingredient as the 100% base instead of computing bogus percentages. The enriched JSON AST now natively includes a `bakersPercentage` field for all ingredients if a reference ingredient is declared or passed via the `bakersReference` option. `convertUnit()` now accepts an optional density (g/mL) to bridge mass ↔ volume conversions; new `resolveIngredientDensity()` and `parseDensityOverrides()` helpers resolve that density from a recipe's `densities:` frontmatter. Also includes a critical null-safety fix when parsing recipes containing standalone comments.
  - **@gram-lang/renderer**: Natively supports formatting Baker's Percentages provided by the analyzer (for HTML and Markdown exports, and the Playground), removing its legacy calculation logic. Fixed `gram print --bakers-math-only` having no effect.
  - **@gram-lang/cli**: The CLI now cleanly acts as a presentation layer for Baker's Math, reading percentages directly from the AST. Added `--bakers-math`, `--bakers-reference`, and `--bakers-math-only` flags to the `view`, `print` and `export` commands. `--scale id=value` now supports same-family unit conversion and cross-family conversion when a density is available; suggests the closest matching ingredient name on a typo; no longer shows corrupted comparison rows for an ingredient split across multiple units in `gram scale`.

### Patch Changes

- e6cf842: Refined formatting and mass normalization for relative quantities:

  - **Cleaner Display**: Relative quantities are now seamlessly displayed without internal `@` or `&` markers (e.g., `125% of lemon juice`). The redundant formula brackets `[125% of...]` have been removed from inline instructions.
  - **Robust Shopping List Aggregation**: The compiler (`@gram-lang/kitchen`) now strictly tracks ingredient lineage using `_usageIds`. This allows the analyzer (`@gram-lang/analyzer`) to flawlessly compute exact masses for complex items in the shopping list without confusing standard ingredients and their alternatives.
  - **Shopping List Accuracy**: When mass normalization is enabled, the shopping list will now accurately display the fully resolved physical mass for relative quantities (e.g., `sugar (156 g)`) instead of falling back to the formula string.

- Updated dependencies [a244341]
- Updated dependencies [1eafa64]
- Updated dependencies [a1e6fe9]
- Updated dependencies [fbe648e]
- Updated dependencies [6013e64]
- Updated dependencies [e6cf842]
- Updated dependencies [2476140]
- Updated dependencies [3f7bc5d]
- Updated dependencies [979f32b]
  - @gram-lang/kitchen@1.0.0-beta.1
  - @gram-lang/parser@1.0.0-beta.1

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

- babbb20: Core language update to enforce new syntax adjustments (breaking changes).

  - **Grammar & Parsing**:
    - Made `{}` optional for single-word ingredients.
    - Replaced temperature symbol with `°`.
    - Replaced async timers with `~&{}`.
    - Replaced aliases brackets with `:`.
    - Tightened `<@` with no spaces allowed.
    - Added fixed modifier `=`.
    - Mandatory `@&` inside relative quantities declarations. (e.g: `@water{60% @&flour}`)
    - **Top-Level Support**: Allowed writing comments and recipe steps globally, anywhere in the document (even before the first `## Section`).
  - **Compiler Analysis**:
    - Added `INVALID_MODIFIER_COMBINATION` warnings.
    - Updated AST transformations to support the new modifiers parsing rules and the implicit top-level sections grouping.

- babbb20: Aligned visual tooling and test recipes with the new grammar.

  - **`GramHighlight.ts` (Playground & VSCode)**: Updated all syntax highlighting regular expressions to accurately match the new syntax (new temperature symbols, updated modifiers, etc.).
  - **Examples (`basquaise_chicken.gram`, `lemon_meringue_pie.gram`, `torture.gram`)**: Fully migrated recipe code to comply with the new grammar.

- caf1630: Major architecture refactoring, ESM Migration, performance optimizations and code cleanup
- babbb20: Complete overhaul of the documentation to reflect the new syntax changes.

### Patch Changes

- b2a235c: NutritionMetrics output field renamed from `salt` to `sodium` to match the ingredient database schema
- Updated dependencies [6e95e35]
- Updated dependencies [79105ce]
- Updated dependencies [babbb20]
- Updated dependencies [babbb20]
- Updated dependencies [caf1630]
- Updated dependencies [babbb20]
- Updated dependencies [2dcd766]
  - @gram-lang/kitchen@1.0.0-beta.0
  - @gram-lang/parser@1.0.0-beta.0

## 0.10.1

### Patch Changes

- Cleaned up and updated dependencies.
- Implemented Turborepo to optimize and simplify project building.

## 0.10.0

### Minor Changes

- d89c2a4: Created a new shared @gram-lang/renderer package to handle HTML and Markdown generation.

### Patch Changes

- 3720644: Added Zod to automatically catch invalid data and prevent crashes.
- 69870cc: Standardized how recipe elements are identified across the system to prevent typos and errors.
