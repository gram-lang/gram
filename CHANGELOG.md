# Changelog

## [1.0.0-beta.4] - 7/23/2026

### 🚨 Major Changes
- Section retro-planning (e.g. `## Section ~{-2h}`) now enforces a strict signed-duration syntax instead of accepting arbitrary free text, preventing invalid timeline calculations. Added support for the `d` (day) time unit.

### ✨ New Features
- Added support for ALAP (As Late As Possible) scheduling. Passive timers and their dependencies are now natively pushed backwards from the end of the recipe, ensuring ingredients are prepared just-in-time rather than sitting idle on the counter. Also introduces two new compiler warnings for timeline conflicts: `TIME_PARADOX` and `TRACK_CONTENTION`.
- Exported the `runPipeline` function alongside its associated types from `@gram-lang/cli` to facilitate library and programmatic usage of the core compiler orchestration.
- Renamed the `cookTime` metric to `idleTime` across the ecosystem to better reflect hands-off wait time. Additionally, passive timers sharing the same name are now automatically sequenced one after another on the same background track.
- Added `llms.txt` and `llms-full.txt` to the documentation site, providing a curated index and full concatenated specification tailored for AI assistants and agents.

### 🐛 Bug Fixes & Improvements
- Fixed the display of alternative ingredient and cookware groups (`@egg|@tofu`). They now correctly render inline as a single joined line in shopping and section lists, rather than being dropped or rendered as oddly-wrapped sub-lists.
- Fixed mass standardization silently failing for alternative ingredient groups. Mass and estimate metrics are now properly computed for each option independently, fixing missing totals in the shopping list.
- Added support for bare single-word children in composite ingredients (e.g., `@juice<@lemon`), and allowed independent preparation instructions on the parent side. Fixed section ingredient lists silently dropping the parent reference.
- Fixed bare ingredient names incorrectly absorbing trailing punctuation (like periods). Also fixed multi-word unbraced names breaking alternative group parsing. (An orphan `|` in step text is now correctly flagged as a parse error).
- Fixed a bug where scaled fractions (e.g., when doubling a recipe) would incorrectly display their original, unscaled text values in section ingredient lists instead of the correctly multiplied amount.
- Fixed an issue where scaled fractions resulting in values below 1 (e.g., `0.5`) were rendered as raw decimals instead of common fractions (e.g., `1/2`) in the section ingredient list.
- Updated the AI generation prompt to accurately reflect the latest language syntax, strict retro-planning rules, and active/passive timer terminology.
- Fixed shopping list ingredient names defaulting to the database's canonical wording when the recipe used a valid alias. The lists now correctly preserve the recipe's original wording or translated alias, ensuring consistent language throughout.
- Fixed a parser crash that occurred when a section header named the section (`->&name`) before defining its retro-planning (`~{-2h}`).
- Fixed section and mise-en-place ingredient lists displaying raw database slug IDs (e.g., `oeufs`) instead of their correct, localized display names (e.g., `œufs`).
- Added detailed per-contribution time breakdowns (Active, Prep, Total) to compiled recipe metrics, and surfaced them as explanatory tooltips on the time summary badges in the HTML renderer.

---

## [1.0.0-beta.3] - 7/14/2026

### 🐛 Bug Fixes & Improvements
- `gram check` now resolves syntax error line numbers from the parser's structured `GramParseError.offset` instead of regexing "line N" out of ohm's prose message — line numbers are now always correct, not just when they happened to match that pattern.
- Downgrade minimum VS Code version requirement to 1.75.0
- Updated deployment configuration to automate npmjs packages publication
- Updated docs for clarity and accuracy.

---

## [1.0.0-beta.2] - 7/13/2026

### 🚨 Major Changes
- fix!: load valid ingredients even when the database has a bad entry, and fix five correctness bugs
- fix!: `gram check` only fails on structural errors by default (use `--strict` for the old behavior), fix LSP completion race, and add ingredients.yaml live reload
- feat!: validate and normalize temperature units, add a shared warning severity map, and fix accented/non-Latin ingredient slugs
- feat!: replace the `°` temperature sigil with `^`, the `~&` passive timer marker with `~_`, and add mixed/Unicode fraction support

### ✨ New Features
- Added a bilingual (EN/FR) "API Reference" section covering the programmatic API of `@gram-lang/parser`, `@gram-lang/kitchen`, `@gram-lang/analyzer`, `@gram-lang/renderer`, and `@gram-lang/i18n` — function signatures, options, JSON data formats, and the full warning-code catalogue. Reference tables (warning codes, AST node types, unit conversions, categories) are generated at build time directly from each package's source, so they can't drift out of sync with the code. Also fixed an incorrect `analyze()` call example in `how-to/build-custom-ui.md`.
- Export `fetchRecipe` and `validateGram` from the recipe-import service, enabling direct testing and reuse of the import validation pipeline.
- Add `round2(value: number): number`, exported from `@gram-lang/kitchen`. It centralizes the 2-decimal rounding rule (`parseFloat(x.toFixed(2))`) previously duplicated across kitchen, analyzer, and renderer, giving quantity/mass rounding a single documented implementation. No observable output changes — same rounding rule as before, just in one place.
- `getAST` now throws `GramParseError` instead of a plain `Error` on syntax errors. This new error type includes structured fields (`offset` and `expected`) while preserving the original human-readable message. The language server now uses the `offset` field to report parse-error diagnostics at their exact location in the document, rather than defaulting to line 1 column 1.
- The playground now shows a red squiggly marker at the exact location of a syntax error using the new `offset` field. Fixed a crash in the playground on mount in real browsers caused by an aggressive automated lint fix that removed necessary Vue `<template>` bindings and component imports.
- `toHTML` no longer stamps footnote anchor ids with `Math.random()`. Output is now deterministic by default (ids like `note-1`), which is required for byte-stable golden/conformance testing. If you render multiple recipes on the same page and relied on random ids to avoid anchor collisions, pass a new `renderId` option (e.g. a recipe slug) to disambiguate.
- Upgraded all monorepo dependencies to their latest versions and implemented a TypeScript 7 dual setup for faster typechecking while preserving compilation toolchain compatibility. Fixed type errors arising from Node 26 and VS Code LSP v10 updates.

### 🐛 Bug Fixes & Improvements
- Added a global `--verbose`/`--debug` flag (works with any subcommand) that prints the full stack trace alongside the usual terse error message — useful when filing a bug report or diagnosing an unexpected failure.
- Fix `_usageId` leaking a global counter across separate `compile()` calls in the same process (affected the language server and `gram scale`'s parallel compiles, making ids non-deterministic for an unchanged recipe). Fix nutrition analysis always reporting `isEstimate: true` regardless of actual data precision. Fix the section mass badge in HTML output missing its scale icon.
- Fixed a regression introduced alongside the new `--verbose` flag where `gram -v` stopped printing the version and showed the help text instead (`-v` is citty's own `--version` shorthand — it's no longer swallowed as part of the verbose flag). Also fixed `gram import`'s fetch timeout message not showing up when the timeout fires while reading a slow response body instead of during the initial connection.
- `.env` is now written with `0600` permissions instead of the OS default, so API keys are no longer group/world-readable on shared machines. `.gram/config.yaml` is now validated at load time (invalid fields fail with a clear error instead of crashing deep in the pipeline). `gram import` now times out after 15s, caps response bodies at 10MB, and asks for confirmation before writing AI-converted content from an untrusted external source to disk (skippable with `--yes`).
- Performance improvements for CLI tools: - `gram format` now processes files concurrently, significantly speeding up execution on large recipe collections. - `gram db sync` now uses a length-based pre-check for fuzzy matching to speed up similarity comparisons against large databases.
- Fixed a bug in `applyScale()` where scaled quantities were incorrectly squared instead of multiplied for inline step ingredients, resulting in incorrect values (e.g., displaying `800g` instead of `400g` when using `--scale 2`). The aggregated shopping list was unaffected.
- chore: declare `sideEffects: false` so bundlers can tree-shake unused exports from these packages No package previously declared this, so third-party bundlers had to assume every module might have side effects and couldn't safely drop unused code.
- fix: sync TextMate grammar with the `^`/`~_` sigil changes and stop mis-highlighting invalid temperature units - Updated TextMate grammar to use `^` (Temperature) and `~_` (Passive Timer) sigils. - Temperature unit highlighting now mirrors the compiler's whitelist (e.g., `180C`/`180°F`). Invalid units now receive a distinct `invalid.illegal.unit.gram` scope. - Name matching now correctly stops at the new `^` sigil.
- Compiler warnings (`CompilationResult.warnings`, `NutritionMetrics.warnings`) are now always structured `Warning` objects (`{ code, message, item?, loc?, section? }`) instead of sometimes being plain strings depending on call order — a latent inconsistency that could previously produce `"[object Object]"` in some rendered output. `Usage.composite`, `Usage.options`, and `ProcessedStep.content` are now properly typed instead of `any`. Also fixes range-based timer quantities (e.g. `~{5-10min}`) never displaying correctly in `gram diff` output, due to a pre-existing typo checking non-existent fields.

#### 💥 Breaking
- `validateIngredientDatabase` no longer throws an error on a single malformed entry. It now validates entry-by-entry, returning both valid data and rejected keys. This prevents `gram check` or `gram cook` from hard-failing due to one unrelated bad line.
- `physical.yield` must now be `> 0` (previously `>= 0`) to prevent producing `Infinity` mass downstream.
- `gram check` now only fails on structural issues (like undefined references) and uses a shared `warningSeverity` map. Nutritional gaps and incomplete annotations are reported as warnings instead of failing the build. Use `--strict` for the old all-warnings-fail behavior.
- `GramConfigError` exit code changed from 2 to 1 (user error, not internal crash).
- The Temperature sigil is now `^` (e.g. `^{180C}`). `°` is no longer a block-opening character, but remains valid inside unit spellings (`°C`).
- The Timer passive marker is now `~_` (e.g. `~_{45min}`) instead of `~&`.
- Temperature units now accept bare `C`/`F` in addition to `°C`/`°F`.

#### 🛠️ Fixed
- Added a guard in `applyYield` against non-positive yield factors.
- Shopping list aggregation: The `optional` modifier is now treated as an intersection rather than a union.
- `diffRecipes`: Temperature ranges that change bounds but keep the same average are now correctly detected in the diff. Fixed an issue where identical section titles would drop timer/temperature tokens.
- `calculateMassMetrics`: Excludes `optional` ingredients from `totalMass` to match nutritional calculations.
- `calculateNutrition`: Missing nutrient data now propagates as `undefined` rather than an indistinguishable `0`.
- Language Server: Fixed a race condition where completions immediately after `@` or `&` could return nothing.
- Language Server: Diagnostics now correctly use the shared `warningSeverity` map.
- Language Server: `ingredients.yaml` is now actively watched via LSP. External edits instantly refresh diagnostics without restarting the editor.

#### 📌 New syntax
- Added support for mixed-number fractions (`1 1/2`) and Unicode vulgar fraction glyphs (`½`).

#### 📌 Kitchen
- `warningSeverity`: a new exported map to separate structural errors from recoverable warnings.
- Temperature units are now validated and normalized to canonical `°C`/`°F`.
- `slugify` now preserves non-Latin letters via `\p{L}`/`\p{N}`.

#### 📌 Analyzer
- Fixed `parseDensityOverrides` name normalization for accented ingredient names.

---

## [1.0.0-beta.1] - 7/5/2026

### 🚨 Major Changes (Breaking Changes)
- refactor: rename `isAsync` to `isPassive` to align with domain terminology

To better align the codebase with the actual domain model of a kitchen, the "asynchronous" timer concept has been completely renamed to "passive". This introduces the following breaking changes for tool builders:

- **AST**: The `TimerAST` node property `isAsync: boolean` is now `isPassive: boolean`.
- **CSS**: The `.timer.async` class generated by the renderer has been renamed to `.timer.passive`.
- **Kitchen Metrics**: All internal variables and comments referring to `async` background tasks have been updated to `passive`.
- **Breaking Change: Refactored Physical Engine Nomenclature**

The physical enrichment options and internal APIs have been renamed for clarity and to align with professional culinary terminology. 

If you are using `@gram-lang/analyzer` programmatically, please update your configuration:
- `enableMassNormalization` is now **`enableMassStandardization`**
- `enableYieldManagement` is now **`enableYieldCalculation`**
- The exported `normalizeMass` helper is now **`standardizeMass`**

This update ensures total parity with the updated official documentation.
- Introduction of the official Gram CLI (`@gram-lang/cli`), a comprehensive command-line tool to manage, compile, and interact with your recipes.

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

### ✨ New Features
- docs: update timer terminology from synchronous/asynchronous to active/passive

To better align with real-world culinary concepts and eliminate confusion, the terminology for timers has been updated throughout the documentation. 

Previously, Gram used computer-science terms (`synchronous` / `asynchronous`) to describe how timers affected the recipe flow. However, in a kitchen environment, almost all timers block the preparation itself, even if they run in the background.

To clarify this, we have shifted the terminology to focus on the cook's availability rather than the execution thread:
- **Synchronous** timers are now referred to as **Active** timers. These timers require the cook's attention and add to the `activeTime` metric.
- **Asynchronous** (`~&`) timers are now referred to as **Passive** (or Idle) timers. These timers represent background tasks (like resting or baking) that free up the cook to perform other steps concurrently.

**Note:** This is a purely conceptual nomenclature change to make the documentation and learning curve more intuitive for non-developers. The underlying syntax (`~{}` and `~&{}`) and the compiler's Gantt chart logic remain exactly the same.
- Major overhaul of the documentation and playground infrastructure:

- **Documentation Rewrite & i18n**: The documentation has been completely rewritten, thoroughly verified, and is now fully translated into French (in addition to the English version).
- **Advanced Vue 3 Playground**: The legacy playground has been removed and rebuilt from the ground up using Vue 3. This new version is directly integrated into the documentation and introduces powerful new features, including recipe scaling and baker's math.
- The `@gram-lang/compiler` package has been renamed to `@gram-lang/kitchen` to fully embrace the Gram language's domain identity.
- docs: integrate new Vitepress documentation site and embedded playground

- **Documentation**: Complete overhaul of the Gram documentation site using Vitepress. Improved layout, better navigation, and comprehensive coverage of the new syntax and APIs.
- **Playground**: Replaced the legacy standalone playground with a new, fully integrated version directly within the Vitepress documentation site. Features live-reloading, side-by-side editing, and syntax highlighting via Shiki.
- Complete overhaul of the VS Code Extension with Language Server, Live Preview, and advanced assistance

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
  - *Quick Fix*: Insert the missing `title:` in the frontmatter.
  - *Quick Fix*: Remove an unused intermediate declaration.
  - *Quick Fix*: Declare a missing intermediate for an existing reference.
  - *Refactor*: Convert a volume quantity to mass directly in the code.
  - *Refactor*: Replace a misspelled ingredient with the closest Fuzzy match suggestion.

**Semantic Highlighting, Formatting & Snippets:**
- **Semantic Tokens**: Regex-based syntax highlighting (TextMate) is replaced by **AST-driven** highlighting. Offers surgical precision for ingredients, timers, temperatures, comments, and nested units (e.g., precise separation of value and unit in `{10g}`).
- **Auto-formatting (`Alt+Shift+F`)**:
  - Normalization of spaces inside curly braces (`{ 200 g }` → `{200g}`).
  - Normalization of composite ingredients (`@a < @b` → `@a<@b`).
  - Alignment of section titles and tab-to-space conversions.
- **Built-in Snippets**: Keyboard shortcuts for the basic structure (frontmatter, sections, steps), ingredient variants (`@ing`, `@?`, `@-`), cookware (`#cw`), and timers/temperatures.
- Core language update to enforce new syntax adjustments (breaking changes).

* **Grammar & Parsing**: 
  * Made `{}` optional for single-word ingredients.
  * Replaced temperature symbol with `°`.
  * Replaced async timers with `~&{}`.
  * Replaced aliases brackets with `:`.
  * Tightened `<@` with no spaces allowed.
  * Added fixed modifier `=`.
  * Mandatory `@&` inside relative quantities declarations. (e.g: `@water{60% @&flour}`)
  * **Top-Level Support**: Allowed writing comments and recipe steps globally, anywhere in the document (even before the first `## Section`).
* **Compiler Analysis**: 
  * Added `INVALID_MODIFIER_COMBINATION` warnings.
  * Updated AST transformations to support the new modifiers parsing rules and the implicit top-level sections grouping.
- Aligned visual tooling and test recipes with the new grammar.

* **`GramHighlight.ts` (Playground & VSCode)**: Updated all syntax highlighting regular expressions to accurately match the new syntax (new temperature symbols, updated modifiers, etc.).
* **Examples (`basquaise_chicken.gram`, `lemon_meringue_pie.gram`, `torture.gram`)**: Fully migrated recipe code to comply with the new grammar.
- Fixed several correctness bugs found during a documentation audit, and added alias-aware cross-unit shopping list aggregation.

- **@gram-lang/analyzer**: `unit_weight`-based conversions (e.g. `@avocado{1}`) were being double-divided by `yield` — the whole-unit weight is now correctly treated as Gross Mass, with Net Mass derived forward (`Gross × yield`), while explicit mass/volume entries keep deriving Gross backward (`Net ÷ yield`) as before. Optional ingredients (`?`) are no longer counted in nutrition totals. New `resolveCanonicalId()` resolves an ingredient name/alias to its database key, and a new `aggregateShoppingList()` step re-groups the shopping list by canonical id — merging aliased ingredients (e.g. `beurre`/`butter`) and cross-unit quantities (e.g. `100g` + `1 cup`) into a single gram total whenever every entry resolves to a mass, falling back to separate entries flagged `multiUnit: true` when a density is missing.
- **@gram-lang/renderer**: The HTML shopping list now clusters consecutive `multiUnit`-flagged entries for the same ingredient under one heading with a "⚠️ Mixed units" badge, instead of listing them as unrelated lines.
- **@gram-lang/cli**: `shopper`'s alias resolution now reuses `@gram-lang/analyzer`'s `resolveCanonicalId()` instead of a separate, duplicated alias map.
- - **Playground**: Migrated syntax highlighting engine from Highlight.js to Shiki. The playground now natively uses the official VSCode TextMate grammar, ensuring 100% consistency across environments.
- **VSCode Extension**: Improved syntax coloring by mapping custom Gram tokens (cookware, intermediate ingredients, units) to standard semantic TextMate scopes, restoring vibrant and legible colors across all VSCode themes.
- Improve ingredient preparation tracking and display.

- **Kitchen**: `aggregateSectionIngredients` now groups ingredients by both `id` and `preparation`, creating separate entries for the same ingredient if it requires different preparations (e.g. cold vs melted).
- **Renderer**: A new `formatMode` option in the render context controls preparation rendering. Preparations remain visible in inline text to prevent information loss. In the section's ingredient list (Mise-en-place), they are cleanly displayed with an em-dash. In the global shopping list, they remain hidden.
- Refactor TextMate grammar to `@gram-lang/parser`

The TextMate grammar (`gram.tmLanguage.json`) has been moved from `@gram-lang/vscode-extension` to `@gram-lang/parser` to colocate the structural (Ohm) and lexical (TextMate) definitions of the Gram language. 

This resolves architectural issues where consumers like the playground had to perform brittle, deep relative imports into the VSCode extension package. The syntax grammar is now officially exported and accessible via `@gram-lang/parser/textmate`.
- Added a centralized `ScaleEngine` in `@gram-lang/kitchen` to make recipe scaling (`--scale`) and Baker's Percentage math safer and more consistent everywhere.

- **@gram-lang/kitchen**: New `resolveScaleFactor()`/`applyScale()` API validates a `--scale` target before computing a factor — rejecting fixed (`@=`) ingredients, relative quantities, ingredients only used inside a sub-recipe, ingredients inside an alternative-ingredient group, and ingredients split across incompatible units, with a clear error instead of a silently wrong number. A sub-recipe's own total (e.g. "2 lemons") is itself a valid scale target. Scaling is now a pure operation (never mutates the original recipe), and the compiled recipe now carries an explicit `scaleFactor` field. Covered by a new unit test suite.
- **@gram-lang/analyzer**: Fixed the `@*` Baker's-reference auto-detection (it silently never matched before), and it now refuses to use a relative-quantity ingredient as the 100% base instead of computing bogus percentages. The enriched JSON AST now natively includes a `bakersPercentage` field for all ingredients if a reference ingredient is declared or passed via the `bakersReference` option. `convertUnit()` now accepts an optional density (g/mL) to bridge mass ↔ volume conversions; new `resolveIngredientDensity()` and `parseDensityOverrides()` helpers resolve that density from a recipe's `densities:` frontmatter. Also includes a critical null-safety fix when parsing recipes containing standalone comments.
- **@gram-lang/renderer**: Natively supports formatting Baker's Percentages provided by the analyzer (for HTML and Markdown exports, and the Playground), removing its legacy calculation logic. Fixed `gram print --bakers-math-only` having no effect.
- **@gram-lang/cli**: The CLI now cleanly acts as a presentation layer for Baker's Math, reading percentages directly from the AST. Added `--bakers-math`, `--bakers-reference`, and `--bakers-math-only` flags to the `view`, `print` and `export` commands. `--scale id=value` now supports same-family unit conversion and cross-family conversion when a density is available; suggests the closest matching ingredient name on a typo; no longer shows corrupted comparison rows for an ingredient split across multiple units in `gram scale`.
- Major architecture refactoring, ESM Migration, performance optimizations and code cleanup
- Complete overhaul of the documentation to reflect the new syntax changes.

### 🐛 Bug Fixes & Improvements
- **Fix: Allow preparations on bare ingredients and cookware**
Previously, the parser and the TextMate syntax highlighter required quantity braces `{}` to attach a preparation to an element (e.g. `@butter{}(melted)` or `#pan{}(20cm)`). 
The grammar has been updated to support attaching preparations directly to bare elements without braces. You can now write `@butter(melted)` or `#pan(20cm)` naturally. The AST will correctly extract the `preparation` property, and your editor will highlight it properly.
- NutritionMetrics output field renamed from `salt` to `sodium` to match the ingredient database schema
- Refined formatting and mass normalization for relative quantities:

- **Cleaner Display**: Relative quantities are now seamlessly displayed without internal `@` or `&` markers (e.g., `125% of lemon juice`). The redundant formula brackets `[125% of...]` have been removed from inline instructions. 
- **Robust Shopping List Aggregation**: The compiler (`@gram-lang/kitchen`) now strictly tracks ingredient lineage using `_usageIds`. This allows the analyzer (`@gram-lang/analyzer`) to flawlessly compute exact masses for complex items in the shopping list without confusing standard ingredients and their alternatives. 
- **Shopping List Accuracy**: When mass normalization is enabled, the shopping list will now accurately display the fully resolved physical mass for relative quantities (e.g., `sugar (156 g)`) instead of falling back to the formula string.
- Fixed an issue in the parser where composite ingredients without braces (e.g., `<@lemon,`) would incorrectly consume subsequent text on the same line, causing missing ingredients and breaking relative quantity resolutions.
- Fix total recipe time calculation when using background timers

Previously, the compiler did not wait for passive tasks (like resting dough in the fridge) to finish before letting you use the result. This caused the estimated "Total Time" to be unrealistically short. The engine now properly understands dependencies and waits for intermediate preparations to be fully ready before proceeding to steps that need them.

---

## [1.0.0-beta.0] - 6/29/2026

### 🚨 Major Changes (Breaking Changes)
- Introduction of the official GRAM CLI (`@gram-lang/cli`), a comprehensive command-line tool to manage, compile, and interact with your recipes.

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

### ✨ New Features
- The `@gram-lang/compiler` package has been renamed to `@gram-lang/kitchen` to fully embrace the Gram language's domain identity.
- Complete **overhaul of the VS Code Extension** with Language Server, Live Preview, and advanced assistance

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
  - *Quick Fix*: Insert the missing `title:` in the frontmatter.
  - *Quick Fix*: Remove an unused intermediate declaration.
  - *Quick Fix*: Declare a missing intermediate for an existing reference.
  - *Refactor*: Convert a volume quantity to mass directly in the code.
  - *Refactor*: Replace a misspelled ingredient with the closest Fuzzy match suggestion.

**Semantic Highlighting, Formatting & Snippets:**
- **Semantic Tokens**: Regex-based syntax highlighting (TextMate) is replaced by **AST-driven** highlighting. Offers surgical precision for ingredients, timers, temperatures, comments, and nested units (e.g., precise separation of value and unit in `{10g}`).
- **Auto-formatting (`Alt+Shift+F`)**:
  - Normalization of spaces inside curly braces (`{ 200 g }` → `{200g}`).
  - Normalization of composite ingredients (`@a < @b` → `@a<@b`).
  - Alignment of section titles and tab-to-space conversions.
- **Built-in Snippets**: Keyboard shortcuts for the basic structure (frontmatter, sections, steps), ingredient variants (`@ing`, `@?`, `@-`), cookware (`#cw`), and timers/temperatures.
- Core language update to enforce new syntax adjustments (breaking changes).

* **Grammar & Parsing**: 
  * Made `{}` optional for single-word ingredients.
  * Replaced temperature symbol with `°`.
  * Replaced async timers with `~&{}`.
  * Replaced aliases brackets with `:`.
  * Tightened `<@` with no spaces allowed.
  * Added fixed modifier `=`.
  * Mandatory `@&` inside relative quantities declarations. (e.g: `@water{60% @&flour}`)
  * **Top-Level Support**: Allowed writing comments and recipe steps globally, anywhere in the document (even before the first `## Section`).
* **Compiler Analysis**: 
  * Added `INVALID_MODIFIER_COMBINATION` warnings.
  * Updated AST transformations to support the new modifiers parsing rules and the implicit top-level sections grouping.
- Aligned visual tooling and test recipes with the new grammar.

* **`GramHighlight.ts` (Playground & VSCode)**: Updated all syntax highlighting regular expressions to accurately match the new syntax (new temperature symbols, updated modifiers, etc.).

- Major architecture refactoring, ESM Migration, performance optimizations and code cleanup
- Complete overhaul of the documentation to reflect the new syntax changes.

### 🐛 Bug Fixes & Improvements
- NutritionMetrics output field renamed from `salt` to `sodium` to match the ingredient database schema

---

## [0.10.1] - 6/14/2026

### 🐛 Bug Fixes & Improvements

- Cleaned up and updated dependencies.
- Implemented Turborepo to optimize and simplify project building.

## [0.10.0] - 6/14/2026

### ✨ New Features
- Added Bun snapshot testing to the development environment for compiler validation.
- Created a new shared @gram-lang/renderer package to handle HTML and Markdown generation.
- Refactored unit translation and normalization into a new centralized @gram-lang/i18n package to remove redundancy between the compiler and analyzer.

### 🐛 Bug Fixes & Improvements
- Refactored the analyzer to reuse the compiler's getNumericQty utility, improving code DRYness and type safety.
- Migrated to full Bun environment using 'workspace:\*' dependencies
- Added Zod to automatically catch invalid data and prevent crashes.
- Improved code safety in the compiler by adding strict type checking for recipe elements.
- Introduce a unified `getNumericQty` utility in `utils.ts` to safely extract numeric values from AST Quantity structures (including fractions, ranges, and nested nodes). This fixes a bug where composite child ingredient quantities using fractions (e.g. `@zest{1/2}`) aggregated to zero in the shopping list.
- Format decimal values strictly below 1 (e.g. `0.5`, `0.25`) as clean culinary fractions (`1/2`, `1/4`) in the shopping list, while keeping standard decimal formatting for values greater than or equal to 1 (e.g. `1.5`).
- Cleaned up repetitive code that manages and saves ingredients and cookware.
- Standardized the warning system to provide consistent and reliable error messages across all tools.
- Improved parser stability and removed complex build workarounds for web environments.
- Refactored AST processing for improved maintainability.
- Standardized how recipe elements are identified across the system to prevent typos and errors.

---

## [0.9.0] - 6/7/2026

### ✨ New Features
- Ingredients states (`@ingredient:state{}`) are removed. While the idea was to better organize the ingredient's database, it just happened to be too confusing to use.
- Updated unit resolution to allow for french aliases (e.g: tsp = càc)
- Ingredient references without quantities (`@&ingredient{}`) are now excluded from section ingredients summaries. This keeps section-level mise en place lists clean by filtering out pure flow instructions (like removing or re-inserting) while preserving separate measured portions.
- Fixed multiple issues with mass calculations
- Extracted analyzer logic (mass normalization, yield management, nutritional estimation) into its own package. Ingredients database must now be provided by the user.
- GRAM syntax now also accepts semantic temperatures (e.g: Cook on !{low heat})

### 🐛 Bug Fixes & Improvements
- Cleaned repo with removal of /dist folders
- Using changesets to simplify changelog management
- Clarification of global comments for a recipe, to be declared in the front matter as "notes"
- Removed unwanted spaces from default playground input
- Empty ingredient masses now count as zero.

---
