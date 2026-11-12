# @gram-lang/language-server

## 1.4.0

### Minor Changes

- c653893: **Comments**: You can now choose whether the comments of a recipe (`// like this`) are shown or left out, in every view:

  - The renderer takes a new `comments: "show" | "hide"` option (default `"show"`): the recipe views, the print and the run sheet all follow it, and hiding leaves no empty notes section behind
  - `gram export`, `gram print` and `gram plan` accept `--comments <show|hide>`
  - A new `gram.comments` setting does the same for the VS Code preview and run sheet, and the playground gets a **Display** section with a switch
  - In the run sheet, comments are set apart discreetly: a note alone on a line sits under its step in small muted text, and one at the end of a line stays in the sentence, between parentheses

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

- b1a15f8: **Rendering**: Durations read more naturally, in the reader's language:

  - A duration of a day or more is written in days and hours, rounded to the hour: a recipe of 25 hours shows `1d 1h` (`1j 1h` in French) instead of `25h 6m`
  - The total time tooltip keeps hours and minutes and ends on the exact total (`= 25h 6min`), so its parts always add up and the rounded `1d 1h` of the pill reads as that same total
  - Minutes are written `min` instead of `m` (`1h 30min`, `45min`), and the units follow the display language in every view: recipe, run sheet, Markdown, text and print
  - `formatDuration()` takes the language as an optional second argument (`formatDuration(1506, "fr")` gives `1j 1h`) and `{ days: false }` as a third to keep hours and minutes; a new `durationUnits` entry of `@gram-lang/i18n` holds the units of each language
  - The time labels are in sentence case (`Total time`, `Temps total`), and the Markdown recipe puts the space French wants before the colon (`**Temps total** : 1j 1h`)
  - The total time hint in the editor, after the recipe's title, says the total as the views do, in the recipe's language

- 931d623: **VS Code / Preview**: The live preview now always shows the nutrition summary, as the playground does:

  - The macros no longer need to be switched on: the energy pill is in the recipe header and the nutrition table sits at the bottom of the recipe
  - The **Macros** button is gone from the editor title bar and from the lens above the file; `Gram: Macros` stays in the Command Palette and scrolls to the table

- d9cf3e2: **Language Server / VS Code**: A new `gram.miseEnPlace` setting chooses when the mise en place is planned, right before each section (`perSection`, the default), all at the start (`upfront`) or at the start of each working day (`perDay`):

  - The preview, the run sheet and the total time hint next to the recipe title all follow it
  - Changing the setting updates every open recipe right away, and a recipe already open when the editor starts follows it too
  - Changing a `gram.*` setting now reaches the language server straight away, without reloading the window (this also applies to `gram.ingredientDatabase.path`)
  - A new `gram.rests` setting (`shortest` by default, `balanced` or `longest`) chooses how long a rest written as a range (`~_{12-24h}`) lasts in the same three places
  - A working day pushed out of its 24 hours by a long rest is flagged on its section (the new `DAY_OVERFLOW` warning)

- bdd85c5: **VS Code / Preview**: The **Scale and stock** section now lets you set the number of portions directly:

  - A new **Portions** field shows the portions the recipe is written for, and scales the recipe when you change it
  - The field only appears when the recipe states its portions

- a20f506: **Language Server / VS Code**: The editor now offers every setting of a recipe, with the same values and default as the command line and the playground:

  - `gram.stepQuantities` writes the quantities in the text of the steps, or leaves them out
  - `gram.nutritionBasis` pins the basis of the nutrition panel (`auto`, the default, keeps the switch in the preview)
  - `gram.bakersMathOnly` shows only the baker's percentages
  - `gram.bakersMath`, `gram.massStandardization`, `gram.yieldCalculation` and `gram.nutritionEstimation` choose what is computed from the ingredient database; all are on by default, and changing one analyzes every open recipe again

- c653893: **Language Server / VS Code**: The editor shows the run sheet of the recipe in place of the Gantt chart:

  - A new `Gram: Run Sheet` command opens it next to the recipe, in days before the service (D-2, D-1, day D); it follows the `gram.miseEnPlace`, `gram.rests` and `gram.comments` settings
  - A **Served at** field at the top of the run sheet puts it on the calendar, with dates and clock times, in your project's time zone and hours (`timezone` and `availability` in `.gram/config.yaml`); **When to serve?** proposes the times that work over the next seven days, the earliest first, and says why the others do not. The serving time is kept per recipe while VS Code is open, never saved
  - A **Scale and stock** section at the top of the recipe and of the run sheet adjusts this sitting, as `--scale`, `--stock` and `--bakers-reference` do in the CLI: a scale in percent or a target quantity of one ingredient, the baker's reference, and the imports already made. These choices are shared by every panel of the recipe and kept while VS Code is open, never saved

  **Deprecated**

  - VS Code: the `Gram: Gantt Chart` command, removed in 2.0.0. It still works and opens the run sheet, with a notice once. Use `Gram: Run Sheet`
  - Language server: the `gram/ganttUpdated` notification, removed in 2.0.0. It is still sent to clients that do not declare the views protocol, and the VS Code extension no longer reads it. Read `gram/viewUpdated` with the `runSheet` output, or the data of the compiled recipe

### Patch Changes

- e40b2c9: **Language Server**: Fixed diagnostics and previews that could go back to an older version of a recipe until the next edit, when it was edited quickly while its imports were being read.

## 1.3.0

No changes in this release.

## 1.2.1

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

## 1.1.0

### Patch Changes

- fbb7511: **Analyzer & Language Server**: Improved nutrient calculation completeness and editor hover precision:
  - Saturated, monounsaturated, polyunsaturated fats, and alcohol are now included in recipe nutrition totals instead of being omitted.
  - `gram db enrich` can now propose monounsaturated and polyunsaturated fat values during ingredient enrichment.
  - Fixed the editor hover tooltip incorrectly displaying sodium in grams instead of milligrams.

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

- 96bfbee: `gram format` and the editor's "format on save" now share the exact same formatting rules, so a recipe formatted by one always looks identical when opened in the other.

  This adds a few new automatic cleanups to both: normalizing spacing around composite ingredients (`@a{} < @b{}` → `@a{}<@b{}`), tidying up intermediate-result declarations (`->&name {}` → `->&name{}`), making sure section headers have exactly one space after the `#`s, and converting tabs to spaces.

- 938afcd: Add an interactive Gantt Chart view to the VS Code extension and export reusable Gantt chart rendering helpers (`toGanttHTML`, `attachGanttInteractivity`) from `@gram-lang/renderer`. Provides a real-time timeline visualization of recipe steps, background timers, and target serving times directly in your editor and the web playground.

### Patch Changes

- 22190b8: Fixed several ways the language server could crash the whole editor session instead of just failing gracefully: a malformed entry in `ingredients.yaml` (e.g. missing `name`) no longer crashes the server, opening a project in a virtual or remote workspace no longer crashes initialization, and a failed background database reload can no longer take down the process. Formatting, rename, and code actions also now always operate on the current document content instead of a possibly-stale cached version.
- 23e4286: `ASTNode` is now a fully exhaustive, discriminated union that matches what the parser actually produces (`CompositeAST`, `QuantityAST`, `TextQuantityAST`, and `RelativeQuantityAST` were previously missing from it), and composite ingredients (`<@parent`) now carry source location info like every other node.

  Making these types honest surfaced and fixed three real bugs in the language server: outline (document symbols), syntax highlighting (semantic tokens), and go-to-definition/rename/hover (reference and intermediate lookups) could silently miss or crash on content that isn't wrapped in a `## Section` header — a recipe with no headers at all, or with a comment before the first header.

## 1.0.0-beta.4

### Patch Changes

- fc47a86: Renamed the `cookTime` metric to `idleTime` across the ecosystem to better reflect hands-off wait time. Additionally, passive timers sharing the same name are now automatically sequenced one after another on the same background track.

## 1.0.0-beta.3

### Patch Changes

- Updated deployment configuration to automate npmjs packages publication

## 1.0.0-beta.2

### Minor Changes

- 6e09879: fix!: `gram check` only fails on structural errors by default (use `--strict` for the old behavior), fix LSP completion race, and add ingredients.yaml live reload

  **Breaking:**

  - `gram check` now only fails on structural issues (like undefined references) and uses a shared `warningSeverity` map. Nutritional gaps and incomplete annotations are reported as warnings instead of failing the build. Use `--strict` for the old all-warnings-fail behavior.
  - `GramConfigError` exit code changed from 2 to 1 (user error, not internal crash).

  **Fixed:**

  - Language Server: Fixed a race condition where completions immediately after `@` or `&` could return nothing.
  - Language Server: Diagnostics now correctly use the shared `warningSeverity` map.
  - Language Server: `ingredients.yaml` is now actively watched via LSP. External edits instantly refresh diagnostics without restarting the editor.

- 6eab9b3: feat!: replace the `°` temperature sigil with `^`, the `~&` passive timer marker with `~_`, and add mixed/Unicode fraction support

  **Breaking syntax changes:**

  - The Temperature sigil is now `^` (e.g. `^{180C}`). `°` is no longer a block-opening character, but remains valid inside unit spellings (`°C`).
  - The Timer passive marker is now `~_` (e.g. `~_{45min}`) instead of `~&`.
  - Temperature units now accept bare `C`/`F` in addition to `°C`/`°F`.

  **New syntax:**

  - Added support for mixed-number fractions (`1 1/2`) and Unicode vulgar fraction glyphs (`½`).

- a46c24f: Upgraded all monorepo dependencies to their latest versions and implemented a TypeScript 7 dual setup for faster typechecking while preserving compilation toolchain compatibility. Fixed type errors arising from Node 26 and VS Code LSP v10 updates.

### Patch Changes

- 404198a: `getAST` now throws `GramParseError` instead of a plain `Error` on syntax errors. This new error type includes structured fields (`offset` and `expected`) while preserving the original human-readable message.

  The language server now uses the `offset` field to report parse-error diagnostics at their exact location in the document, rather than defaulting to line 1 column 1.

- Updated dependencies [815ce8c]
- Updated dependencies [0aec389]
- Updated dependencies [e192fe2]
- Updated dependencies [404198a]
- Updated dependencies [8fca04c]
- Updated dependencies [d837da3]
- Updated dependencies [f5f1efe]
- Updated dependencies [8dc9c60]
- Updated dependencies [6eab9b3]
- Updated dependencies [e55940f]
- Updated dependencies [a46c24f]
- Updated dependencies [0ccfc99]
  - @gram-lang/analyzer@1.0.0-beta.2
  - @gram-lang/kitchen@1.0.0-beta.2
  - @gram-lang/renderer@1.0.0-beta.2
  - @gram-lang/parser@1.0.0-beta.2
  - @gram-lang/i18n@1.0.0-beta.2

## 1.0.0-beta.1

### Minor Changes

- a1e6fe9: refactor: rename `isAsync` to `isPassive` to align with domain terminology

  To better align the codebase with the actual domain model of a kitchen, the "asynchronous" timer concept has been completely renamed to "passive". This introduces the following breaking changes for tool builders:

  - **AST**: The `TimerAST` node property `isAsync: boolean` is now `isPassive: boolean`.
  - **CSS**: The `.timer.async` class generated by the renderer has been renamed to `.timer.passive`.
  - **Kitchen Metrics**: All internal variables and comments referring to `async` background tasks have been updated to `passive`.

### Patch Changes

- 02d63ff: **Breaking Change: Refactored Physical Engine Nomenclature**

  The physical enrichment options and internal APIs have been renamed for clarity and to align with professional culinary terminology.

  If you are using `@gram-lang/analyzer` programmatically, please update your configuration:

  - `enableMassNormalization` is now **`enableMassStandardization`**
  - `enableYieldManagement` is now **`enableYieldCalculation`**
  - The exported `normalizeMass` helper is now **`standardizeMass`**

  This update ensures total parity with the updated official documentation.

- Updated dependencies [a244341]
- Updated dependencies [1eafa64]
- Updated dependencies [a1e6fe9]
- Updated dependencies [8921d9d]
- Updated dependencies [fbe648e]
- Updated dependencies [02d63ff]
- Updated dependencies [6013e64]
- Updated dependencies [e6cf842]
- Updated dependencies [2476140]
- Updated dependencies [3f7bc5d]
- Updated dependencies [979f32b]
  - @gram-lang/analyzer@1.0.0-beta.1
  - @gram-lang/renderer@1.0.0-beta.1
  - @gram-lang/kitchen@1.0.0-beta.1
  - @gram-lang/parser@1.0.0-beta.1
  - @gram-lang/i18n@1.0.0-beta.1

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

- 6e95e35: The `@gram-lang/compiler` package has been renamed to `@gram-lang/kitchen` to fully embrace the Gram language's domain identity.
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

### Patch Changes

- Updated dependencies [6e95e35]
- Updated dependencies [79105ce]
- Updated dependencies [babbb20]
- Updated dependencies [b2a235c]
- Updated dependencies [babbb20]
- Updated dependencies [caf1630]
- Updated dependencies [babbb20]
- Updated dependencies [2dcd766]
  - @gram-lang/analyzer@1.0.0-beta.0
  - @gram-lang/kitchen@1.0.0-beta.0
  - @gram-lang/renderer@1.0.0-beta.0
  - @gram-lang/parser@1.0.0-beta.0
  - @gram-lang/i18n@1.0.0-beta.0
