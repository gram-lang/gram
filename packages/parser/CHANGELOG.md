# @gram-lang/parser

## 1.0.1

## 1.0.0

### Major Changes

- Gram v1.0.0 Official Launch! 🎉

  This milestone release marks the official 1.0.0 launch of Gram:

  - **Brand-New Website & Documentation**: Rebuilt using Astro and Starlight with refined guides and an integrated blog.
  - **Refreshed Visual Identity**: Brand-new logo.
  - **Infrastructure & Stability**: Monorepo stability, test coverage, and migration to self-hosted Forgejo (`git.gram-lang.org`) mirrored to GitHub and Codeberg.

## 1.0.0-beta.5

### Patch Changes

- 9553678: Fixed a major parsing bug where a bare `@ingredient` or `#cookware` mention (one written without its own `{}`) would silently swallow an unrelated timer, temperature, cookware, or ingredient that appeared later on the same line into its own name, if that later element happened to close with a valid quantity — losing that element from the recipe entirely. For example, `Brown the @&chicken for ~{3min}.` used to lose the timer completely, turning it into a single ingredient named "chicken for ~". Both the ingredient and cookware name now stop at the same sigils (`@`, `#`, `~`, `^`, `&`) that a bare reference (`&name`) already correctly stopped at.
- 23e4286: `ASTNode` is now a fully exhaustive, discriminated union that matches what the parser actually produces (`CompositeAST`, `QuantityAST`, `TextQuantityAST`, and `RelativeQuantityAST` were previously missing from it), and composite ingredients (`<@parent`) now carry source location info like every other node.

  Making these types honest surfaced and fixed three real bugs in the language server: outline (document symbols), syntax highlighting (semantic tokens), and go-to-definition/rename/hover (reference and intermediate lookups) could silently miss or crash on content that isn't wrapped in a `## Section` header — a recipe with no headers at all, or with a comment before the first header.

- 901e90e: Fixed two silent quantity-corruption bugs in fraction parsing: a decimal numerator (e.g. `1.5/2`) used to be truncated to an integer before dividing, silently turning `1.5/2` into `0.5` instead of `0.75`; a zero denominator (e.g. `1/0`) used to produce `Infinity`, which serializes to `null` in JSON, instead of being rejected outright.
- 064ba9f: Fixed syntax highlighting (TextMate grammar): a bare `@ingredient`, `#cookware`, or `<@parent` mention with no `{}` of its own would have its highlighted span incorrectly extend all the way to the next unrelated `{...}` on the line (e.g. a later `&reference{}`), coloring everything in between as if it were part of the same name. The name-matching patterns now stop at `@`, `#`, `~`, `^`, and `&`, the same sigils the compiler itself stops at.
- d61d786: `QuantityValueAST` (the parser's internal representation of a parsed number/fraction/range) is now a proper discriminated union instead of a flat interface with every field optional. This is an internal type-safety improvement with no behavior change — it's what would have caught, at compile time, a real bug fixed earlier in `diffRecipes` (checking `qty.from`/`qty.to`, fields that never existed on any variant).

## 1.0.0-beta.4

### Major Changes

- 68365c4: Section retro-planning (e.g. `## Section ~{-2h}`) now enforces a strict signed-duration syntax instead of accepting arbitrary free text, preventing invalid timeline calculations. Added support for the `d` (day) time unit.

### Patch Changes

- 0bee2b2: Added support for bare single-word children in composite ingredients (e.g., `@juice<@lemon`), and allowed independent preparation instructions on the parent side. Fixed section ingredient lists silently dropping the parent reference.
- e659677: Fixed bare ingredient names incorrectly absorbing trailing punctuation (like periods). Also fixed multi-word unbraced names breaking alternative group parsing. (An orphan `|` in step text is now correctly flagged as a parse error).
- 68365c4: Fixed a parser crash that occurred when a section header named the section (`->&name`) before defining its retro-planning (`~{-2h}`).

## 1.0.0-beta.3

### Patch Changes

- Updated deployment configuration to automate npmjs packages publication

## 1.0.0-beta.2

### Major Changes

- 6eab9b3: feat!: replace the `°` temperature sigil with `^`, the `~&` passive timer marker with `~_`, and add mixed/Unicode fraction support

  **Breaking syntax changes:**

  - The Temperature sigil is now `^` (e.g. `^{180C}`). `°` is no longer a block-opening character, but remains valid inside unit spellings (`°C`).
  - The Timer passive marker is now `~_` (e.g. `~_{45min}`) instead of `~&`.
  - Temperature units now accept bare `C`/`F` in addition to `°C`/`°F`.

  **New syntax:**

  - Added support for mixed-number fractions (`1 1/2`) and Unicode vulgar fraction glyphs (`½`).

### Minor Changes

- 404198a: `getAST` now throws `GramParseError` instead of a plain `Error` on syntax errors. This new error type includes structured fields (`offset` and `expected`) while preserving the original human-readable message.

  The language server now uses the `offset` field to report parse-error diagnostics at their exact location in the document, rather than defaulting to line 1 column 1.

- a46c24f: Upgraded all monorepo dependencies to their latest versions and implemented a TypeScript 7 dual setup for faster typechecking while preserving compilation toolchain compatibility. Fixed type errors arising from Node 26 and VS Code LSP v10 updates.

### Patch Changes

- f5f1efe: chore: declare `sideEffects: false` so bundlers can tree-shake unused exports from these packages

  No package previously declared this, so third-party bundlers had to assume every module might have side effects and couldn't safely drop unused code.

- e55940f: fix: sync TextMate grammar with the `^`/`~_` sigil changes and stop mis-highlighting invalid temperature units

  - Updated TextMate grammar to use `^` (Temperature) and `~_` (Passive Timer) sigils.
  - Temperature unit highlighting now mirrors the compiler's whitelist (e.g., `180C`/`180°F`). Invalid units now receive a distinct `invalid.illegal.unit.gram` scope.
  - Name matching now correctly stops at the new `^` sigil.

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

- 6013e64: Refactor TextMate grammar to `@gram-lang/parser`

  The TextMate grammar (`gram.tmLanguage.json`) has been moved from `@gram-lang/vscode-extension` to `@gram-lang/parser` to colocate the structural (Ohm) and lexical (TextMate) definitions of the Gram language.

  This resolves architectural issues where consumers like the playground had to perform brittle, deep relative imports into the VSCode extension package. The syntax grammar is now officially exported and accessible via `@gram-lang/parser/textmate`.

### Patch Changes

- 1eafa64: **Fix: Allow preparations on bare ingredients and cookware**
  Previously, the parser and the TextMate syntax highlighter required quantity braces `{}` to attach a preparation to an element (e.g. `@butter{}(melted)` or `#pan{}(20cm)`).
  The grammar has been updated to support attaching preparations directly to bare elements without braces. You can now write `@butter(melted)` or `#pan(20cm)` naturally. The AST will correctly extract the `preparation` property, and your editor will highlight it properly.
- 3f7bc5d: Fixed an issue in the parser where composite ingredients without braces (e.g., `<@lemon,`) would incorrectly consume subsequent text on the same line, causing missing ingredients and breaking relative quantity resolutions.

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

## 0.10.1

### Patch Changes

- Cleaned up and updated dependencies.
- Implemented Turborepo to optimize and simplify project building.

## 0.10.0

### Patch Changes

- 3720644: Added Zod to automatically catch invalid data and prevent crashes.
- 63ec5a4: Improved code safety in the compiler by adding strict type checking for recipe elements.
- 087b78b: Improved parser stability and removed complex build workarounds for web environments.
- 69870cc: Standardized how recipe elements are identified across the system to prevent typos and errors.

## 0.9.0

### Minor Changes

- 2963b48: Ingredients states (`@ingredient:state{}`) are removed. While the idea was to better organize the ingredient's database, it just happened to be too confusing to use.
- 2963b48: Extracted analyzer logic (mass normalization, yield management, nutritional estimation) into its own package. Ingredients database must now be provided by the user.
- 2550f2a: GRAM syntax now also accepts semantic temperatures (e.g: Cook on !{low heat})

### Patch Changes

- 2550f2a: Cleaned repo with removal of /dist folders
- 7f4fa0d: Using changesets to simplify changelog management
- 664ea91: Clarification of global comments for a recipe, to be declared in the front matter as "notes"
