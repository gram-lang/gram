# @gram-lang/vscode-extension

## 1.4.1

### Patch Changes

- Updated dependencies [2327de6]
- Updated dependencies [7de7b3f]
- Updated dependencies [7fbd5c6]
- Updated dependencies [2327de6]
- Updated dependencies [7fbd5c6]
  - @gram-lang/renderer@1.4.1
  - @gram-lang/language-server@1.4.1

## 1.4.0

### Minor Changes

- **VS Code / Run sheet**: The editor shows the run sheet of the recipe in place of the Gantt chart:

  - A new `Gram: Run Sheet` command opens it next to the recipe, in days before the service (D-2, D-1, day D); it follows the `gram.miseEnPlace`, `gram.rests` and `gram.comments` settings
  - A **Served at** field at the top of the run sheet puts it on the calendar, with dates and clock times, in your project's time zone and hours (`timezone` and `availability` in `.gram/config.yaml`); **When to serve?** proposes the times that work over the next seven days, the earliest first, and says why the others do not. The serving time is kept per recipe while VS Code is open, never saved
  - A **Scale and stock** section at the top of the recipe and of the run sheet adjusts this sitting, as `--scale`, `--stock` and `--bakers-reference` do in the CLI: a scale in percent or a target quantity of one ingredient, the baker's reference, and the imports already made. These choices are shared by every panel of the recipe and kept while VS Code is open, never saved

  **Deprecated**

  - VS Code: the `Gram: Gantt Chart` command, removed in 2.0.0. It still works and opens the run sheet, with a notice once. Use `Gram: Run Sheet`
  - Language server: the `gram/ganttUpdated` notification, removed in 2.0.0. It is still sent to clients that do not declare the views protocol, and the VS Code extension no longer reads it. Read `gram/viewUpdated` with the `runSheet` output, or the data of the compiled recipe

- **VS Code / Settings**: The editor now offers every setting of a recipe, with the same values and default as the command line and the playground:

  - `gram.miseEnPlace` (`perSection`, the default, `upfront` or `perDay`) chooses when the mise en place is planned, and `gram.rests` (`shortest`, the default, `balanced` or `longest`) how long a rest written as a range (`~_{12-24h}`) lasts; the preview, the run sheet and the total time hint next to the recipe title all follow them
  - `gram.stepQuantities` writes the quantities in the text of the steps, or leaves them out, `gram.nutritionBasis` pins the basis of the nutrition (`auto` is the default) and `gram.bakersMathOnly` shows only the baker's percentages
  - `gram.bakersMath`, `gram.massStandardization`, `gram.yieldCalculation` and `gram.nutritionEstimation` choose what is computed from the ingredient database; all are on by default
  - Changing a `gram.*` setting now reaches the language server straight away, without reloading the window (this also applies to `gram.ingredientDatabase.path`), updates every open recipe, and a recipe already open when the editor starts follows it too

- **Comments**: You can now choose whether the comments of a recipe (`// like this`) are shown or left out, in every view:

  - The renderer takes a new `comments: "show" | "hide"` option (default `"show"`) that the recipe views, the print and the run sheet follow; hiding leaves no empty notes section behind
  - `gram export`, `gram print` and `gram plan` accept `--comments <show|hide>`, and the editor has a new `gram.comments` setting for the preview and the run sheet; the playground gets a **Display** section with a switch
  - In the run sheet, a note alone on a line sits under its step in small muted text, and one at the end of a line stays in the sentence, between parentheses

- **Renderer / HTML recipe**: The HTML recipe has a new design, and the printed recipe follows it:

  - A better organized header (title, description, author, source, tags), a summary bar with the portions, the yield, the mass and the energy, and a bar for the times
  - Tooltips that stay readable wherever they open in the window, with more practical information: quantity, weight and how it was estimated, preparation, what a part is taken from
  - A more interactive recipe: hover an ingredient or a piece of cookware to see the steps that use it, tick the steps off, and follow what a step makes to the steps that use it
  - The printed recipe (`gram print`, `gram export --format html`) now looks like the one on screen, in black and white, with boxes to tick
  - Each view keeps its own styles (`@gram-lang/renderer/gram.css` is imported as before and relies on the CSS `@scope` rule, supported by every current browser), so one view can no longer change another

  **Deprecated**

  - Renderer: the `interactiveScaling` option of `toHTML()`, and the `decreasePortions`, `increasePortions` and `editPortions` strings of `@gram-lang/i18n`, removed in 2.0.0. The portions stepper they draw only works where the page around the recipe handles its buttons, so it did nothing in an exported file or an editor preview. Scale the recipe before rendering it instead (`applyScale()` of `@gram-lang/kitchen`): the recipe then shows its portions and its scale factor by itself. The option keeps working until 2.0.0

- **Renderer / Nutrition**: The nutrition of the HTML recipe is now a compact table, like a European food label, and easy to reach from the top of the recipe:

  - One column per basis, side by side (per 100 g, then per portion), with the energy as the first row in kJ and kcal and the whole recipe underneath; no more switching between bases
  - A `%RI` column gives each nutrient's share of the reference intake of an average adult (8,400 kJ / 2,000 kcal), per portion
  - The hero bar shows the energy (`493 kcal per portion`, or per 100 g when the recipe declares no portions); clicking it jumps to the table
  - Sodium is now shown as salt, in grams (sodium × 2.5), and calories as energy, in every view and every language
  - With the `nutritionBasis` setting set to one basis, the table and the hero bar show that basis alone
  - The Markdown and plain text recipes show the same table by default, instead of the values per portion only

  **Deprecated**

  - Renderer: the `interactiveNutrition` option no longer has any effect, since every basis is shown at once, and is removed in 2.0.0. Remove it from your calls

- **VS Code / Views**: Unified view panels and new developer inspectors:

  - A new `Gram: Show View...` command lists all available views and opens the selected one: recipe preview, run sheet, and developer inspectors (composed AST and compiled JSON, as source text or an interactive tree). `Gram: Live Preview`, `Gram: Run Sheet` and `Gram: Macros` remain available as direct shortcuts
  - Open panels follow the active `.gram` editor tab, refresh when brought back into focus, and the language server computes only the panels that are visible
  - When a recipe contains errors, panels keep their last valid rendering, dimmed beneath a banner with a button that jumps to the error, instead of going blank
  - The live preview always shows the nutrition summary, as the playground does: the **Macros** button is gone, and `Gram: Macros` scrolls to the table
  - The **Scale and stock** section has a **Portions** field, shown when the recipe states its portions, that scales the recipe when you change it

### Patch Changes

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
