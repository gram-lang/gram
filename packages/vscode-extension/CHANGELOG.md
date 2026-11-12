# @gram-lang/vscode-extension

## 1.4.0

### Minor Changes

- c653893: **Comments**: You can now choose whether the comments of a recipe (`// like this`) are shown or left out, in every view:

  - The renderer takes a new `comments: "show" | "hide"` option (default `"show"`): the recipe views, the print and the run sheet all follow it, and hiding leaves no empty notes section behind
  - `gram export`, `gram print` and `gram plan` accept `--comments <show|hide>`
  - A new `gram.comments` setting does the same for the VS Code preview and run sheet, and the playground gets a **Display** section with a switch
  - In the run sheet, comments are set apart discreetly: a note alone on a line sits under its step in small muted text, and one at the end of a line stays in the sentence, between parentheses

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

- dc6899d: **Nutrition & Rendering**: The nutrition of the HTML recipe is now a compact table, like a European food label, and easy to reach from the top of the recipe:

  - One column per basis, side by side (per 100 g, then per portion), with the energy as the first row in kJ and kcal and the whole recipe underneath; no more switching between bases
  - A `%RI` column gives each nutrient's share of the reference intake of an average adult (8,400 kJ / 2,000 kcal), per portion
  - The hero bar shows the energy (`493 kcal per portion`, or per 100 g when the recipe declares no portions); clicking it jumps to the table
  - Sodium is now shown as salt, in grams (sodium × 2.5), and calories as energy, in every view and every language: the HTML and printed recipe, Markdown, plain text and the terminal
  - With the `nutritionBasis` setting set to one basis, the table and the hero bar show that basis alone
  - The Markdown and plain text recipes show the same table by default (per 100 g and per portion side by side, the `%RI` column and the whole recipe underneath), instead of the values per portion only
  - **Deprecated**: the `interactiveNutrition` option of the renderer no longer has any effect, since every basis is shown at once. Remove it; it will be removed in 2.0.0

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

- bf48534: **VS Code**: Unified view panels and new developer inspectors:

  - A new `Gram: Show View...` command lists all available views and opens the selected one: recipe preview, operational run sheet, and developer inspectors (composed AST and compiled JSON, formatted as source text or an interactive tree). Existing commands `Gram: Live Preview`, `Gram: Run Sheet`, and `Gram: Macros` remain available as direct shortcuts
  - Open panels automatically follow the active `.gram` editor tab, and the language server computes only panels that are currently visible
  - When a recipe contains errors, active panels pause and retain their last valid rendered state (dimmed beneath a banner with a shortcut button jumping to the error location) instead of blanking or displaying redundant error cards
  - Panels hidden in inactive editor tabs automatically refresh to the latest version when brought back into focus

### Patch Changes

- 85de159: **VS Code / Preview**: Badges, total time, dotted lines and action outlines in the live preview and the run sheet now use a neutral gray border instead of the theme's blue, in light and dark themes.
- Updated dependencies [c653893]
- Updated dependencies [e40b2c9]
- Updated dependencies [588328e]
- Updated dependencies [b1a15f8]
- Updated dependencies [dc6899d]
- Updated dependencies [dc6899d]
- Updated dependencies [32ba341]
- Updated dependencies [12e7460]
- Updated dependencies [dc6899d]
- Updated dependencies [523a241]
- Updated dependencies [26171cc]
- Updated dependencies [c653893]
- Updated dependencies [879594d]
- Updated dependencies [a20f506]
- Updated dependencies [c653893]
- Updated dependencies [931d623]
- Updated dependencies [d9cf3e2]
- Updated dependencies [bdd85c5]
- Updated dependencies [a20f506]
- Updated dependencies [c653893]
  - @gram-lang/renderer@1.4.0
  - @gram-lang/language-server@1.4.0

## 1.3.0

### Patch Changes

- Updated dependencies [4c9652c]
- Updated dependencies [95698cc]
  - @gram-lang/renderer@1.3.0
  - @gram-lang/language-server@1.3.0

## 1.2.1

### Patch Changes

- 532ea55: **Renderer**: Switched icons to embedded inline SVGs, removing external CDN dependencies (`unpkg.com`) and enabling full offline previews in VS Code.
- Updated dependencies [532ea55]
- Updated dependencies [728e2ba]
  - @gram-lang/renderer@1.2.1
  - @gram-lang/language-server@1.2.1

## 1.2.0

### Patch Changes

- Updated dependencies [2bab3cd]
- Updated dependencies [8a4056b]
  - @gram-lang/renderer@1.2.0
  - @gram-lang/language-server@1.2.0

## 1.1.0

### Patch Changes

- Updated dependencies [fbb7511]
- Updated dependencies [fbb7511]
  - @gram-lang/language-server@1.1.0
  - @gram-lang/renderer@1.1.0

## 1.0.1

### Patch Changes

- @gram-lang/renderer@1.0.1
- @gram-lang/language-server@1.0.1

## 1.0.0

### Major Changes

- Gram v1.0.0 Official Launch! 🎉

  This milestone release marks the official 1.0.0 launch of Gram:

  - **Brand-New Website & Documentation**: Rebuilt using Astro and Starlight with refined guides and an integrated blog.
  - **Refreshed Visual Identity**: Brand-new logo.
  - **Infrastructure & Stability**: Monorepo stability, test coverage, and migration to self-hosted Forgejo (`git.gram-lang.org`) mirrored to GitHub and Codeberg.

## 0.2.0-beta.0

### Minor Changes

- 938afcd: Add an interactive Gantt Chart view to the VS Code extension and export reusable Gantt chart rendering helpers (`toGanttHTML`, `attachGanttInteractivity`) from `@gram-lang/renderer`. Provides a real-time timeline visualization of recipe steps, background timers, and target serving times directly in your editor and the web playground.

### Patch Changes

- 064ba9f: Fixed syntax highlighting (TextMate grammar): a bare `@ingredient`, `#cookware`, or `<@parent` mention with no `{}` of its own would have its highlighted span incorrectly extend all the way to the next unrelated `{...}` on the line (e.g. a later `&reference{}`), coloring everything in between as if it were part of the same name. The name-matching patterns now stop at `@`, `#`, `~`, `^`, and `&`, the same sigils the compiler itself stops at.
- Updated dependencies [7b246ae]
- Updated dependencies [22190b8]
- Updated dependencies [23e4286]
- Updated dependencies [19a9f19]
- Updated dependencies [73fde5e]
- Updated dependencies [3fae598]
- Updated dependencies [a55dca8]
- Updated dependencies [d61d786]
- Updated dependencies [2ed4707]
- Updated dependencies [96bfbee]
- Updated dependencies [938afcd]
  - @gram-lang/renderer@1.0.0-beta.5
  - @gram-lang/language-server@1.0.0-beta.5

## 0.1.4-beta.0

### Patch Changes

- Updated dependencies [fc47a86]
  - @gram-lang/language-server@1.0.0-beta.4

## 1.0.0-beta.3

### Patch Changes

- Downgrade minimum VS Code version requirement to 1.75.0
- Updated deployment configuration to automate npmjs packages publication
- Updated dependencies
  - @gram-lang/language-server@1.0.0-beta.3

## 1.0.0-beta.2

### Minor Changes

- a46c24f: Upgraded all monorepo dependencies to their latest versions and implemented a TypeScript 7 dual setup for faster typechecking while preserving compilation toolchain compatibility. Fixed type errors arising from Node 26 and VS Code LSP v10 updates.

### Patch Changes

- Updated dependencies [6e09879]
- Updated dependencies [404198a]
- Updated dependencies [6eab9b3]
- Updated dependencies [a46c24f]
  - @gram-lang/language-server@1.0.0-beta.2

## 1.0.0-beta.1

### Minor Changes

- a244341: Major overhaul of the documentation and playground infrastructure:

  - **Documentation Rewrite & i18n**: The documentation has been completely rewritten, thoroughly verified, and is now fully translated into French (in addition to the English version).
  - **Advanced Vue 3 Playground**: The legacy playground has been removed and rebuilt from the ground up using Vue 3. This new version is directly integrated into the documentation and introduces powerful new features, including recipe scaling and baker's math.

- a1e6fe9: refactor: rename `isAsync` to `isPassive` to align with domain terminology

  To better align the codebase with the actual domain model of a kitchen, the "asynchronous" timer concept has been completely renamed to "passive". This introduces the following breaking changes for tool builders:

  - **AST**: The `TimerAST` node property `isAsync: boolean` is now `isPassive: boolean`.
  - **CSS**: The `.timer.async` class generated by the renderer has been renamed to `.timer.passive`.
  - **Kitchen Metrics**: All internal variables and comments referring to `async` background tasks have been updated to `passive`.

### Patch Changes

- 9ff4563: - **Playground**: Migrated syntax highlighting engine from Highlight.js to Shiki. The playground now natively uses the official VSCode TextMate grammar, ensuring 100% consistency across environments.
  - **VSCode Extension**: Improved syntax coloring by mapping custom Gram tokens (cookware, intermediate ingredients, units) to standard semantic TextMate scopes, restoring vibrant and legible colors across all VSCode themes.
- 6013e64: Refactor TextMate grammar to `@gram-lang/parser`

  The TextMate grammar (`gram.tmLanguage.json`) has been moved from `@gram-lang/vscode-extension` to `@gram-lang/parser` to colocate the structural (Ohm) and lexical (TextMate) definitions of the Gram language.

  This resolves architectural issues where consumers like the playground had to perform brittle, deep relative imports into the VSCode extension package. The syntax grammar is now officially exported and accessible via `@gram-lang/parser/textmate`.

- Updated dependencies [a1e6fe9]
- Updated dependencies [02d63ff]
  - @gram-lang/language-server@1.0.0-beta.1

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

- Updated dependencies [6e95e35]
- Updated dependencies [79105ce]
- Updated dependencies [caf1630]
- Updated dependencies [2dcd766]
  - @gram-lang/language-server@1.0.0-beta.0

## 0.10.1

## 0.10.0

### Patch Changes

- 3720644: Added Zod to automatically catch invalid data and prevent crashes.

## 0.9.0

### Minor Changes

- 2963b48: Ingredients states (`@ingredient:state{}`) are removed. While the idea was to better organize the ingredient's database, it just happened to be too confusing to use.
- 2963b48: Extracted analyzer logic (mass normalization, yield management, nutritional estimation) into its own package. Ingredients database must now be provided by the user.

### Patch Changes

- 2550f2a: Cleaned repo with removal of /dist folders
- 7f4fa0d: Using changesets to simplify changelog management
- 664ea91: Clarification of global comments for a recipe, to be declared in the front matter as "notes"
