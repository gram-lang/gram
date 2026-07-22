# @gram-lang/analyzer

## 1.0.0-beta.4

### Patch Changes

- 383c825: Fixed mass standardization silently failing for alternative ingredient groups. Mass and estimate metrics are now properly computed for each option independently, fixing missing totals in the shopping list.
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

### Major Changes

- 815ce8c: fix!: load valid ingredients even when the database has a bad entry, and fix five correctness bugs

  **Breaking:**

  - `validateIngredientDatabase` no longer throws an error on a single malformed entry. It now validates entry-by-entry, returning both valid data and rejected keys. This prevents `gram check` or `gram cook` from hard-failing due to one unrelated bad line.
  - `physical.yield` must now be `> 0` (previously `>= 0`) to prevent producing `Infinity` mass downstream.

  **Fixed:**

  - Added a guard in `applyYield` against non-positive yield factors.
  - Shopping list aggregation: The `optional` modifier is now treated as an intersection rather than a union.
  - `diffRecipes`: Temperature ranges that change bounds but keep the same average are now correctly detected in the diff. Fixed an issue where identical section titles would drop timer/temperature tokens.
  - `calculateMassMetrics`: Excludes `optional` ingredients from `totalMass` to match nutritional calculations.
  - `calculateNutrition`: Missing nutrient data now propagates as `undefined` rather than an indistinguishable `0`.

### Minor Changes

- a46c24f: Upgraded all monorepo dependencies to their latest versions and implemented a TypeScript 7 dual setup for faster typechecking while preserving compilation toolchain compatibility. Fixed type errors arising from Node 26 and VS Code LSP v10 updates.

### Patch Changes

- 0aec389: Fix `_usageId` leaking a global counter across separate `compile()` calls in the same
  process (affected the language server and `gram scale`'s parallel compiles, making ids
  non-deterministic for an unchanged recipe). Fix nutrition analysis always reporting
  `isEstimate: true` regardless of actual data precision. Fix the section mass badge in
  HTML output missing its scale icon.
- f5f1efe: chore: declare `sideEffects: false` so bundlers can tree-shake unused exports from these packages

  No package previously declared this, so third-party bundlers had to assume every module might have side effects and couldn't safely drop unused code.

- 8dc9c60: feat!: validate and normalize temperature units, add a shared warning severity map, and fix accented/non-Latin ingredient slugs

  **Kitchen:**

  - `warningSeverity`: a new exported map to separate structural errors from recoverable warnings.
  - Temperature units are now validated and normalized to canonical `°C`/`°F`.
  - `slugify` now preserves non-Latin letters via `\p{L}`/`\p{N}`.

  **Analyzer:**

  - Fixed `parseDensityOverrides` name normalization for accented ingredient names.

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

- 02d63ff: **Breaking Change: Refactored Physical Engine Nomenclature**

  The physical enrichment options and internal APIs have been renamed for clarity and to align with professional culinary terminology.

  If you are using `@gram-lang/analyzer` programmatically, please update your configuration:

  - `enableMassNormalization` is now **`enableMassStandardization`**
  - `enableYieldManagement` is now **`enableYieldCalculation`**
  - The exported `normalizeMass` helper is now **`standardizeMass`**

  This update ensures total parity with the updated official documentation.

### Minor Changes

- a244341: Major overhaul of the documentation and playground infrastructure:

  - **Documentation Rewrite & i18n**: The documentation has been completely rewritten, thoroughly verified, and is now fully translated into French (in addition to the English version).
  - **Advanced Vue 3 Playground**: The legacy playground has been removed and rebuilt from the ground up using Vue 3. This new version is directly integrated into the documentation and introduces powerful new features, including recipe scaling and baker's math.

- 8921d9d: Fixed several correctness bugs found during a documentation audit, and added alias-aware cross-unit shopping list aggregation.

  - **@gram-lang/analyzer**: `unit_weight`-based conversions (e.g. `@avocado{1}`) were being double-divided by `yield` — the whole-unit weight is now correctly treated as Gross Mass, with Net Mass derived forward (`Gross × yield`), while explicit mass/volume entries keep deriving Gross backward (`Net ÷ yield`) as before. Optional ingredients (`?`) are no longer counted in nutrition totals. New `resolveCanonicalId()` resolves an ingredient name/alias to its database key, and a new `aggregateShoppingList()` step re-groups the shopping list by canonical id — merging aliased ingredients (e.g. `beurre`/`butter`) and cross-unit quantities (e.g. `100g` + `1 cup`) into a single gram total whenever every entry resolves to a mass, falling back to separate entries flagged `multiUnit: true` when a density is missing.
  - **@gram-lang/renderer**: The HTML shopping list now clusters consecutive `multiUnit`-flagged entries for the same ingredient under one heading with a "⚠️ Mixed units" badge, instead of listing them as unrelated lines.
  - **@gram-lang/cli**: `shopper`'s alias resolution now reuses `@gram-lang/analyzer`'s `resolveCanonicalId()` instead of a separate, duplicated alias map.

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
  - @gram-lang/i18n@1.0.0-beta.0

## 0.10.1

### Patch Changes

- Cleaned up and updated dependencies.
- Implemented Turborepo to optimize and simplify project building.
- Updated dependencies
  - @gram-lang/kitchen@0.10.1
  - @gram-lang/parser@0.10.1
  - @gram-lang/i18n@0.10.1

## 0.10.0

### Minor Changes

- dc98e0b: Added Bun snapshot testing to the development environment for compiler validation.
- cfda9e1: Refactored unit translation and normalization into a new centralized @gram-lang/i18n package to remove redundancy between the compiler and analyzer.

### Patch Changes

- c720fa1: Refactored the analyzer to reuse the compiler's getNumericQty utility, improving code DRYness and type safety.
- 705bb45: Migrated to full Bun environment using 'workspace:\*' dependencies
- 3720644: Added Zod to automatically catch invalid data and prevent crashes.
- 833cfbf: Standardized the warning system to provide consistent and reliable error messages across all tools.
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
  - @gram-lang/kitchen@0.10.0
  - @gram-lang/i18n@0.10.0
  - @gram-lang/parser@0.10.0

## 0.9.0

### Minor Changes

- 2963b48: Ingredients states (`@ingredient:state{}`) are removed. While the idea was to better organize the ingredient's database, it just happened to be too confusing to use.
- 2963b48: Updated unit resolution to allow for french aliases (e.g: tsp = càc)
- 2963b48: Fixed multiple issues with mass calculations
- 2963b48: Extracted analyzer logic (mass normalization, yield management, nutritional estimation) into its own package. Ingredients database must now be provided by the user.

### Patch Changes

- 2550f2a: Cleaned repo with removal of /dist folders
- 7f4fa0d: Using changesets to simplify changelog management
- 664ea91: Clarification of global comments for a recipe, to be declared in the front matter as "notes"
- 2963b48: Empty ingredient masses now count as zero.
