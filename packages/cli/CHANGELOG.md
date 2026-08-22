# @gram-lang/cli

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
- 2561210: **CLI**: Added automatic update checking and a new `gram upgrade` command:
  - gram now checks npm in the background and prints a short "update available" notice after a command finishes (skipped in CI and non-interactive runs).
  - Added `gram upgrade` to check for and install the latest version on demand — it always performs a fresh check and asks for confirmation before running the install.
  - Added an `updateCheck: false` setting in `config.yaml` (or the `GRAM_NO_UPDATE_CHECK` environment variable for a single run) to opt out of the passive notice.
- c31a583: **Parser & Kitchen**: Composite ingredients written with a short, generic child name (like `@juice<@lemon`) are now protected against a silent ingredient-database mix-up:
  - The compiler now warns when the same short composite name (e.g. "juice") is drawn from two different parents within one recipe (lemon in one step, orange in another) — until now this went unnoticed and the two usages silently shared one entry in the ingredient database.
  - `gram db sync` reports the same conflict across your whole recipe collection, so two unrelated recipes that happen to use the same generic composite name don't overwrite each other's nutrition and density data.
  - The AI recipe importer (`gram import`) now writes composite ingredients with their full name (e.g. "lemon juice") instead of a short generic one, so newly imported recipes don't create this conflict in the first place.

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
  - @gram-lang/format@1.2.0

## 1.1.0

### Minor Changes

- 4765cb4: **CLI / Import**: Support importing recipes directly from **YouTube videos and Shorts** via `gram import`:
  - Uses Gemini multimodal video understanding to analyze cooking videos and generate structured `.gram` recipes.
  - Automatically populates `title:`, `author:` (channel name), and `source:` metadata from YouTube.
  - Automatically normalizes YouTube Shorts URLs to standard video formats.
  - Added `--max-duration` (default 20 minutes) to prevent accidental token overconsumption on long videos.
  - Displays upfront video duration and estimated token cost when `YOUTUBE_API_KEY` is configured.
- b66b785: **CLI / AI**: Explicit AI model and provider selection for all AI commands (`gram import`, `gram db lint`, `gram db enrich`):
  - Added `--model`, `--provider`, and `--pick-model` CLI flags to inspect or override the active model per run without altering persistent config.
  - The CLI now displays the active AI provider, model, and configuration source before execution.
  - Isolated provider API keys so credentials configured for a specific provider are never leaked or reused when switching providers.
  - Fixed `gram import` hanging in non-interactive environments when `--output` was used without `--yes`.
- 1881ed0: **CLI / Database**: Added physical coherence and sanity checks across `gram db validate` and `gram db enrich`:
  - `gram db validate` checks calorie consistency against Atwater estimates (4 kcal/g protein/carbs, 9 kcal/g fat, 7 kcal/g alcohol).
  - `gram db validate` checks sub-macro coherence (sugars exceeding total carbs, fat sub-types exceeding total fat).
  - `gram db validate` enforces category-based density sanity ranges and unit weight bounds.
  - `gram db enrich` constrains AI estimates within physical limits and prompts self-verification of Atwater consistency.
  - `gram db enrich` passes known ingredient categories to the AI to reduce guesswork.
- 1581ff9: **CLI / Database**: `gram db enrich` now walks you through an interactive review before writing AI estimates to `ingredients.yaml`:
  - Preview, accept, edit, or skip AI-proposed density, unit weight, and nutrition values per ingredient.
  - Unedited AI values are tagged with `# [LLM]` in `ingredients.yaml` to track provenance.
  - Added `--report` (`-r`) to preview needed database enrichments without writing changes, matching `gram db lint --report` (replaces `--dry-run` / `-n`).
  - Added `--yes` (`-y`) to accept all estimates automatically for non-interactive scripting.
  - Automatically falls back to accepting values with a warning when executed in non-interactive (non-TTY) environments.
- d47ee12: **CLI / Import**: Added integrity guardrails and diagnostic reporting to `gram import`:
  - Validates compiled AST tokens against AI output to detect lost ingredients or truncated steps, aborting instead of writing corrupted files (overridable with `--force`).
  - Reports uncorrected AI generation errors with actionable diagnostics.
  - Identifies imported ingredients missing quantities and lists their line numbers for easy manual completion.
  - Reports unknown database ingredients and unweighed units when an ingredient database is present.
  - Prevented hallucinated placeholder metadata in `author:` and `source:` fields.
  - Redirected progress indicators to `stderr` so stdout redirection (`gram import ... > recipe.gram`) produces clean recipe files.
- fbb7511: **Nutrition & Rendering**: Support flexible nutrition serving bases (per portion and per 100 g) alongside whole-recipe totals:
  - Declaring `portions:` in recipe frontmatter now calculates per-portion nutrition and keeps values constant when scaling recipes.
  - Added a standardized `per-100g` nutrition basis calculated from raw assembled recipe mass.
  - Added the `--nutrition <auto|total|per-portion|per-100g>` option to `gram view`, `gram export`, and `gram print`.
  - Added nutrition basis toggles in the web playground and VS Code live preview.
  - Localized all nutrient names and table headers across supported languages (French and English).

### Patch Changes

- b3a509a: **Parser & Kitchen**: Fixed an issue where multi-word composite ingredients marked with `&` (e.g. `@juice{1}<@&unwaxed lemon{}`) were duplicated in the shopping list instead of being combined into a single purchase item.
- fbb7511: **Analyzer & Language Server**: Improved nutrient calculation completeness and editor hover precision:
  - Saturated, monounsaturated, polyunsaturated fats, and alcohol are now included in recipe nutrition totals instead of being omitted.
  - `gram db enrich` can now propose monounsaturated and polyunsaturated fat values during ingredient enrichment.
  - Fixed the editor hover tooltip incorrectly displaying sodium in grams instead of milligrams.
- Updated dependencies [b3a509a]
- Updated dependencies [fbb7511]
- Updated dependencies [fbb7511]
- Updated dependencies [fbb7511]
  - @gram-lang/parser@1.1.0
  - @gram-lang/kitchen@1.1.0
  - @gram-lang/analyzer@1.1.0
  - @gram-lang/renderer@1.1.0
  - @gram-lang/i18n@1.1.0
  - @gram-lang/format@1.1.0

## 1.0.1

### Patch Changes

- 46a32fc: Fixed the `--help` description of `gram check` to clarify that it also checks database completeness by default, unless `--skip-db` is used.
- e03abd7: Reduced the AI provider costs of running `gram import`:
  - Prompt caching is now enabled, so retries reuse the cached prompt instead of paying full price.
  - The command now sends a minimized recipe payload instead of the full raw webpage data.
  - The self-correction loop no longer spends retries on informational warnings (like missing database ingredients).
  - Formatting is now handled locally instead of spending an AI call to fix it.
- e03abd7: Improved the quality and correctness of recipes generated by `gram import`:
  - Fixed an issue where English words would leak into non-English recipes.
  - Fixed grammatical errors (dropped articles) around ingredient and cookware references in non-English output.
  - Descriptive adjectives (like "boneless skinless") are now correctly extracted as preparation steps instead of creating unwieldy ingredient names.
  - Corrected the generated syntax for multi-word cookware references.
  - Fixed an issue where the target language was sometimes incorrectly inferred.
  - Improved decoding of accented characters and punctuation from the source recipe.
- e03abd7: Improved the CLI guidance printed after running `gram import`:
  - It now correctly points to `gram db sync` as the recommended next step.
  - It accurately reports any remaining compiler warnings (e.g., missing ingredients) instead of silently discarding them.
- 7d61f97: Fixed `gram init` to ensure the interactive AI provider setup accurately offers the currently recommended models (e.g., llama4).
  - @gram-lang/analyzer@1.0.1
  - @gram-lang/kitchen@1.0.1
  - @gram-lang/parser@1.0.1
  - @gram-lang/i18n@1.0.1
  - @gram-lang/renderer@1.0.1
  - @gram-lang/format@1.0.1

## 1.0.0

### Major Changes

- Gram v1.0.0 Official Launch! 🎉

  This milestone release marks the official 1.0.0 launch of Gram:

  - **Brand-New Website & Documentation**: Rebuilt using Astro and Starlight with refined guides and an integrated blog.
  - **Refreshed Visual Identity**: Brand-new logo.
  - **Infrastructure & Stability**: Monorepo stability, test coverage, and migration to self-hosted Forgejo (`git.gram-lang.org`) mirrored to GitHub and Codeberg.

## 1.0.0-beta.5

### Minor Changes

- b1aa8db: The `language:` setting in `.gram/config.yaml` now also affects unit conversion and the shopping list's category order (e.g. a database with French category names like "Légumes" now sorts correctly when `language: "fr"` is set) — previously it only affected AI-generated content.
- 96bfbee: `gram format` and the editor's "format on save" now share the exact same formatting rules, so a recipe formatted by one always looks identical when opened in the other.

  This adds a few new automatic cleanups to both: normalizing spacing around composite ingredients (`@a{} < @b{}` → `@a{}<@b{}`), tidying up intermediate-result declarations (`->&name {}` → `->&name{}`), making sure section headers have exactly one space after the `#`s, and converting tabs to spaces.

### Patch Changes

- 1ade4e1: Fixed a bug where the wrong API key could be sent to the wrong AI provider. If you had, say, `GEMINI_API_KEY` set in your environment but configured `provider: openai` in `.gram/config.yaml`, your Gemini key could be sent to OpenAI instead. Each provider now only ever uses its own key.
- 72ef907: Warnings about invalid ingredient database entries now go to stderr instead of stdout, so commands like `gram build recipe.gram | jq` no longer break when the database has a bad entry.
- 2bdd3d7: `gram shop` now groups the shopping list by the same category names used everywhere else in the project (e.g. "Seafood" instead of "Fish", "Vegetables" instead of "Produce") instead of its own inconsistent list.
- 19f7fe3: Fixed `gram format` rewriting values inside the recipe's frontmatter (the `---` metadata block at the top of a `.gram` file). For example, an email address like `Jean@Example.com` in `author:` used to get incorrectly lowercased to `Jean@example.com`. Frontmatter is no longer touched by formatting rules meant for the recipe body. File writes are also now atomic and lock-protected, matching the rest of the CLI.
- 293d43e: `gram import <url>` now refuses to fetch addresses that aren't publicly routable (localhost, private networks, link-local/cloud metadata addresses), including on redirects — closing a way for a malicious or compromised page to make the CLI fetch internal network resources. API keys stored via `gram init`/`gram config set` are now actually picked up when running the CLI under Node (previously only worked when run via Bun). `gram db enrich` now clearly reports when nothing was written to disk instead of claiming success; AI-suggested ingredient values that are physically implausible (like an ingredient density far outside any real food) are now rejected instead of being written to your ingredient database.
- Updated dependencies [cf39429]
- Updated dependencies [b1aa8db]
- Updated dependencies [3afd970]
- Updated dependencies [8f7e887]
- Updated dependencies [5194ba4]
- Updated dependencies [1d86e74]
- Updated dependencies [7b246ae]
- Updated dependencies [f147b25]
- Updated dependencies [9553678]
- Updated dependencies [99aa179]
- Updated dependencies [68a2a45]
- Updated dependencies [7c83cf8]
- Updated dependencies [dcaadd7]
- Updated dependencies [0c2e818]
- Updated dependencies [943e9f8]
- Updated dependencies [24a108c]
- Updated dependencies [970c32b]
- Updated dependencies [23e4286]
- Updated dependencies [901e90e]
- Updated dependencies [19a9f19]
- Updated dependencies [73fde5e]
- Updated dependencies [3fae598]
- Updated dependencies [064ba9f]
- Updated dependencies [b1aa8db]
- Updated dependencies [a55dca8]
- Updated dependencies [79d835c]
- Updated dependencies [d61d786]
- Updated dependencies [2ed4707]
- Updated dependencies [938afcd]
  - @gram-lang/format@1.0.0-beta.5
  - @gram-lang/analyzer@1.0.0-beta.5
  - @gram-lang/renderer@1.0.0-beta.5
  - @gram-lang/parser@1.0.0-beta.5
  - @gram-lang/i18n@1.0.0-beta.5
  - @gram-lang/kitchen@1.0.0-beta.5

## 1.0.0-beta.4

### Minor Changes

- 301ad01: Exported the `runPipeline` function alongside its associated types from `@gram-lang/cli` to facilitate library and programmatic usage of the core compiler orchestration.
- fc47a86: Renamed the `cookTime` metric to `idleTime` across the ecosystem to better reflect hands-off wait time. Additionally, passive timers sharing the same name are now automatically sequenced one after another on the same background track.

### Patch Changes

- e659677: Fixed bare ingredient names incorrectly absorbing trailing punctuation (like periods). Also fixed multi-word unbraced names breaking alternative group parsing. (An orphan `|` in step text is now correctly flagged as a parse error).
- 67b6fe4: Updated the AI generation prompt to accurately reflect the latest language syntax, strict retro-planning rules, and active/passive timer terminology.
- b546f96: Fixed shopping list ingredient names defaulting to the database's canonical wording when the recipe used a valid alias. The lists now correctly preserve the recipe's original wording or translated alias, ensuring consistent language throughout.
- c1c9b53: Fixed section and mise-en-place ingredient lists displaying raw database slug IDs (e.g., `oeufs`) instead of their correct, localized display names (e.g., `œufs`).
- Updated dependencies [06039f2]
- Updated dependencies [7487b09]
- Updated dependencies [383c825]
- Updated dependencies [0bee2b2]
- Updated dependencies [e659677]
- Updated dependencies [aa0c082]
- Updated dependencies [cb6b794]
- Updated dependencies [fc47a86]
- Updated dependencies [b546f96]
- Updated dependencies [68365c4]
- Updated dependencies [c1c9b53]
- Updated dependencies [68365c4]
- Updated dependencies [55430e4]
  - @gram-lang/kitchen@1.0.0-beta.4
  - @gram-lang/renderer@1.0.0-beta.4
  - @gram-lang/analyzer@1.0.0-beta.4
  - @gram-lang/parser@1.0.0-beta.4
  - @gram-lang/i18n@1.0.0-beta.4

## 1.0.0-beta.3

### Patch Changes

- 0438aba: `gram check` now resolves syntax error line numbers from the parser's structured `GramParseError.offset` instead of regexing "line N" out of ohm's prose message — line numbers are now always correct, not just when they happened to match that pattern.
- Updated deployment configuration to automate npmjs packages publication
- Updated dependencies
  - @gram-lang/analyzer@1.0.0-beta.3
  - @gram-lang/i18n@1.0.0-beta.3
  - @gram-lang/kitchen@1.0.0-beta.3
  - @gram-lang/parser@1.0.0-beta.3
  - @gram-lang/renderer@1.0.0-beta.3

## 1.0.0-beta.2

### Major Changes

- 6e09879: fix!: `gram check` only fails on structural errors by default (use `--strict` for the old behavior), fix LSP completion race, and add ingredients.yaml live reload

  **Breaking:**

  - `gram check` now only fails on structural issues (like undefined references) and uses a shared `warningSeverity` map. Nutritional gaps and incomplete annotations are reported as warnings instead of failing the build. Use `--strict` for the old all-warnings-fail behavior.
  - `GramConfigError` exit code changed from 2 to 1 (user error, not internal crash).

  **Fixed:**

  - Language Server: Fixed a race condition where completions immediately after `@` or `&` could return nothing.
  - Language Server: Diagnostics now correctly use the shared `warningSeverity` map.
  - Language Server: `ingredients.yaml` is now actively watched via LSP. External edits instantly refresh diagnostics without restarting the editor.

### Minor Changes

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

- 5217ab8: Export `fetchRecipe` and `validateGram` from the recipe-import service, enabling
  direct testing and reuse of the import validation pipeline.
- 6eab9b3: feat!: replace the `°` temperature sigil with `^`, the `~&` passive timer marker with `~_`, and add mixed/Unicode fraction support

  **Breaking syntax changes:**

  - The Temperature sigil is now `^` (e.g. `^{180C}`). `°` is no longer a block-opening character, but remains valid inside unit spellings (`°C`).
  - The Timer passive marker is now `~_` (e.g. `~_{45min}`) instead of `~&`.
  - Temperature units now accept bare `C`/`F` in addition to `°C`/`°F`.

  **New syntax:**

  - Added support for mixed-number fractions (`1 1/2`) and Unicode vulgar fraction glyphs (`½`).

- a46c24f: Upgraded all monorepo dependencies to their latest versions and implemented a TypeScript 7 dual setup for faster typechecking while preserving compilation toolchain compatibility. Fixed type errors arising from Node 26 and VS Code LSP v10 updates.

### Patch Changes

- dad09ac: Added a global `--verbose`/`--debug` flag (works with any subcommand) that
  prints the full stack trace alongside the usual terse error message —
  useful when filing a bug report or diagnosing an unexpected failure.
- d202df0: Fixed a regression introduced alongside the new `--verbose` flag where
  `gram -v` stopped printing the version and showed the help text instead
  (`-v` is citty's own `--version` shorthand — it's no longer swallowed as
  part of the verbose flag). Also fixed `gram import`'s fetch timeout message
  not showing up when the timeout fires while reading a slow response body
  instead of during the initial connection.
- 92a0b47: `.env` is now written with `0600` permissions instead of the OS default, so API
  keys are no longer group/world-readable on shared machines. `.gram/config.yaml`
  is now validated at load time (invalid fields fail with a clear error instead of
  crashing deep in the pipeline). `gram import` now times out after 15s, caps
  response bodies at 10MB, and asks for confirmation before writing AI-converted
  content from an untrusted external source to disk (skippable with `--yes`).
- 129736f: Performance improvements for CLI tools:
  - `gram format` now processes files concurrently, significantly speeding up execution on large recipe collections.
  - `gram db sync` now uses a length-based pre-check for fuzzy matching to speed up similarity comparisons against large databases.
- d837da3: Fixed a bug in `applyScale()` where scaled quantities were incorrectly squared instead of multiplied for inline step ingredients, resulting in incorrect values (e.g., displaying `800g` instead of `400g` when using `--scale 2`). The aggregated shopping list was unaffected.
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

- a244341: Major overhaul of the documentation and playground infrastructure:

  - **Documentation Rewrite & i18n**: The documentation has been completely rewritten, thoroughly verified, and is now fully translated into French (in addition to the English version).
  - **Advanced Vue 3 Playground**: The legacy playground has been removed and rebuilt from the ground up using Vue 3. This new version is directly integrated into the documentation and introduces powerful new features, including recipe scaling and baker's math.

- a1e6fe9: refactor: rename `isAsync` to `isPassive` to align with domain terminology

  To better align the codebase with the actual domain model of a kitchen, the "asynchronous" timer concept has been completely renamed to "passive". This introduces the following breaking changes for tool builders:

  - **AST**: The `TimerAST` node property `isAsync: boolean` is now `isPassive: boolean`.
  - **CSS**: The `.timer.async` class generated by the renderer has been renamed to `.timer.passive`.
  - **Kitchen Metrics**: All internal variables and comments referring to `async` background tasks have been updated to `passive`.

- 2476140: Added a centralized `ScaleEngine` in `@gram-lang/kitchen` to make recipe scaling (`--scale`) and Baker's Percentage math safer and more consistent everywhere.

  - **@gram-lang/kitchen**: New `resolveScaleFactor()`/`applyScale()` API validates a `--scale` target before computing a factor — rejecting fixed (`@=`) ingredients, relative quantities, ingredients only used inside a sub-recipe, ingredients inside an alternative-ingredient group, and ingredients split across incompatible units, with a clear error instead of a silently wrong number. A sub-recipe's own total (e.g. "2 lemons") is itself a valid scale target. Scaling is now a pure operation (never mutates the original recipe), and the compiled recipe now carries an explicit `scaleFactor` field. Covered by a new unit test suite.
  - **@gram-lang/analyzer**: Fixed the `@*` Baker's-reference auto-detection (it silently never matched before), and it now refuses to use a relative-quantity ingredient as the 100% base instead of computing bogus percentages. The enriched JSON AST now natively includes a `bakersPercentage` field for all ingredients if a reference ingredient is declared or passed via the `bakersReference` option. `convertUnit()` now accepts an optional density (g/mL) to bridge mass ↔ volume conversions; new `resolveIngredientDensity()` and `parseDensityOverrides()` helpers resolve that density from a recipe's `densities:` frontmatter. Also includes a critical null-safety fix when parsing recipes containing standalone comments.
  - **@gram-lang/renderer**: Natively supports formatting Baker's Percentages provided by the analyzer (for HTML and Markdown exports, and the Playground), removing its legacy calculation logic. Fixed `gram print --bakers-math-only` having no effect.
  - **@gram-lang/cli**: The CLI now cleanly acts as a presentation layer for Baker's Math, reading percentages directly from the AST. Added `--bakers-math`, `--bakers-reference`, and `--bakers-math-only` flags to the `view`, `print` and `export` commands. `--scale id=value` now supports same-family unit conversion and cross-family conversion when a density is available; suggests the closest matching ingredient name on a typo; no longer shows corrupted comparison rows for an ingredient split across multiple units in `gram scale`.

### Patch Changes

- 8921d9d: Fixed several correctness bugs found during a documentation audit, and added alias-aware cross-unit shopping list aggregation.

  - **@gram-lang/analyzer**: `unit_weight`-based conversions (e.g. `@avocado{1}`) were being double-divided by `yield` — the whole-unit weight is now correctly treated as Gross Mass, with Net Mass derived forward (`Gross × yield`), while explicit mass/volume entries keep deriving Gross backward (`Net ÷ yield`) as before. Optional ingredients (`?`) are no longer counted in nutrition totals. New `resolveCanonicalId()` resolves an ingredient name/alias to its database key, and a new `aggregateShoppingList()` step re-groups the shopping list by canonical id — merging aliased ingredients (e.g. `beurre`/`butter`) and cross-unit quantities (e.g. `100g` + `1 cup`) into a single gram total whenever every entry resolves to a mass, falling back to separate entries flagged `multiUnit: true` when a density is missing.
  - **@gram-lang/renderer**: The HTML shopping list now clusters consecutive `multiUnit`-flagged entries for the same ingredient under one heading with a "⚠️ Mixed units" badge, instead of listing them as unrelated lines.
  - **@gram-lang/cli**: `shopper`'s alias resolution now reuses `@gram-lang/analyzer`'s `resolveCanonicalId()` instead of a separate, duplicated alias map.

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
