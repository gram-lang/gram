# @gram/playground

## 1.0.0-beta.0

### Major Changes

- 2dcd766: Introduction of the official GRAM CLI (`@gram/cli`), a comprehensive command-line tool to manage, compile, and interact with your recipes.

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

- 6e95e35: The `@gram/compiler` package has been renamed to `@gram/kitchen` to fully embrace the Gram language's domain identity.
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
- Updated dependencies [babbb20]
- Updated dependencies [b2a235c]
- Updated dependencies [babbb20]
- Updated dependencies [caf1630]
- Updated dependencies [babbb20]
- Updated dependencies [2dcd766]
  - @gram/analyzer@1.0.0-beta.0
  - @gram/kitchen@1.0.0-beta.0
  - @gram/renderer@1.0.0-beta.0
  - @gram/parser@1.0.0-beta.0

## 0.10.1

### Patch Changes

- Cleaned up and updated dependencies.
- Implemented Turborepo to optimize and simplify project building.
- Updated dependencies
  - @gram/analyzer@0.10.1
  - @gram/kitchen@0.10.1
  - @gram/renderer@0.10.1
  - @gram/parser@0.10.1

## 0.10.0

### Minor Changes

- d89c2a4: Created a new shared @gram/renderer package to handle HTML and Markdown generation.

### Patch Changes

- 705bb45: Migrated to full Bun environment using 'workspace:\*' dependencies
- 3720644: Added Zod to automatically catch invalid data and prevent crashes.
- cdf3181: Format decimal values strictly below 1 (e.g. `0.5`, `0.25`) as clean culinary fractions (`1/2`, `1/4`) in the shopping list, while keeping standard decimal formatting for values greater than or equal to 1 (e.g. `1.5`).
- 087b78b: Improved parser stability and removed complex build workarounds for web environments.
- 69870cc: Standardized how recipe elements are identified across the system to prevent typos and errors.
- Updated dependencies [dc98e0b]
- Updated dependencies [d89c2a4]
- Updated dependencies [c720fa1]
- Updated dependencies [705bb45]
- Updated dependencies [3720644]
- Updated dependencies [63ec5a4]
- Updated dependencies [cfda9e1]
- Updated dependencies [cdf3181]
- Updated dependencies [05791fd]
- Updated dependencies [833cfbf]
- Updated dependencies [087b78b]
- Updated dependencies [919f299]
- Updated dependencies [69870cc]
  - @gram/analyzer@0.10.0
  - @gram/renderer@0.10.0
  - @gram/kitchen@0.10.0
  - @gram/parser@0.10.0

## 0.9.0

### Minor Changes

- 2963b48: Ingredients states (`@ingredient:state{}`) are removed. While the idea was to better organize the ingredient's database, it just happened to be too confusing to use.
- 2963b48: Extracted analyzer logic (mass normalization, yield management, nutritional estimation) into its own package. Ingredients database must now be provided by the user.
- 2550f2a: GRAM syntax now also accepts semantic temperatures (e.g: Cook on !{low heat})

### Patch Changes

- 2550f2a: Cleaned repo with removal of /dist folders
- 7f4fa0d: Using changesets to simplify changelog management
- 664ea91: Clarification of global comments for a recipe, to be declared in the front matter as "notes"
- 2550f2a: Removed unwanted spaces from default playground input
