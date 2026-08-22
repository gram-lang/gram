# Changelog

## [1.2.0](https://git.gram-lang.org/gram-lang/gram/compare/v.1.1.0...v.1.2.0) - 2026-08-22

### New features
- **Parser & Kitchen**: Introduced modular recipes and multi-file imports via the `@use` directive:
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
- **CLI**: Added automatic update checking and a new `gram upgrade` command:
  - gram now checks npm in the background and prints a short "update available" notice after a command finishes (skipped in CI and non-interactive runs).
  - Added `gram upgrade` to check for and install the latest version on demand — it always performs a fresh check and asks for confirmation before running the install.
  - Added an `updateCheck: false` setting in `config.yaml` (or the `GRAM_NO_UPDATE_CHECK` environment variable for a single run) to opt out of the passive notice.
- **Parser & Kitchen**: Composite ingredients written with a short, generic child name (like `@juice<@lemon`) are now protected against a silent ingredient-database mix-up:
  - The compiler now warns when the same short composite name (e.g. "juice") is drawn from two different parents within one recipe (lemon in one step, orange in another) — until now this went unnoticed and the two usages silently shared one entry in the ingredient database.
  - `gram db sync` reports the same conflict across your whole recipe collection, so two unrelated recipes that happen to use the same generic composite name don't overwrite each other's nutrition and density data.
  - The AI recipe importer (`gram import`) now writes composite ingredients with their full name (e.g. "lemon juice") instead of a short generic one, so newly imported recipes don't create this conflict in the first place.

### Bug fixes and improvements
- **Parser & Kitchen**: Fixed `gram scale` (and any other caller that re-scales an already-compiled recipe) silently leaving alternative ingredient groups (`@butter|@margarine`) and composite parent-draw quantities (`@egg-yolks{2}<@eggs{3}`) unscaled.
- **Parser & Kitchen**: Improved clarity and tone for diagnostic messages and revised severity tiers:
  - Reworded compiler and module diagnostic messages to provide actionable guidance and avoid alarmist phrasing for standard culinary approximations.
  - Reclassified non-critical notices (`MISSING_MACROS`, `UNKNOWN_MASS`, `TRACK_CONTENTION`) to `info` severity so they do not clutter warning counters.
  - Enhanced Playground and editor diagnostic styling with dedicated color schemes for errors (red), warnings (amber), and notices (blue).
- **Language Server**: Normalized error states and unified diagnostic handling across Playground and VSCode extensions:
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
- **Parser & Kitchen**: Fixed a false circular reference warning when multiple sections used percentage-of formulas on same-named ingredients by scoping cycle detection per section.

---

## [1.1.0](https://git.gram-lang.org/gram-lang/gram/compare/v.1.0.1...v.1.1.0) - 2026-08-16

### New features
- **CLI / Import**: Support importing recipes directly from **YouTube videos and Shorts** via `gram import`:
  - Uses Gemini multimodal video understanding to analyze cooking videos and generate structured `.gram` recipes.
  - Automatically populates `title:`, `author:` (channel name), and `source:` metadata from YouTube.
  - Automatically normalizes YouTube Shorts URLs to standard video formats.
  - Added `--max-duration` (default 20 minutes) to prevent accidental token overconsumption on long videos.
  - Displays upfront video duration and estimated token cost when `YOUTUBE_API_KEY` is configured.
- **CLI / AI**: Explicit AI model and provider selection for all AI commands (`gram import`, `gram db lint`, `gram db enrich`):
  - Added `--model`, `--provider`, and `--pick-model` CLI flags to inspect or override the active model per run without altering persistent config.
  - The CLI now displays the active AI provider, model, and configuration source before execution.
  - Isolated provider API keys so credentials configured for a specific provider are never leaked or reused when switching providers.
  - Fixed `gram import` hanging in non-interactive environments when `--output` was used without `--yes`.
- **CLI / Database**: Added physical coherence and sanity checks across `gram db validate` and `gram db enrich`:
  - `gram db validate` checks calorie consistency against Atwater estimates (4 kcal/g protein/carbs, 9 kcal/g fat, 7 kcal/g alcohol).
  - `gram db validate` checks sub-macro coherence (sugars exceeding total carbs, fat sub-types exceeding total fat).
  - `gram db validate` enforces category-based density sanity ranges and unit weight bounds.
  - `gram db enrich` constrains AI estimates within physical limits and prompts self-verification of Atwater consistency.
  - `gram db enrich` passes known ingredient categories to the AI to reduce guesswork.
- **CLI / Database**: `gram db enrich` now walks you through an interactive review before writing AI estimates to `ingredients.yaml`:
  - Preview, accept, edit, or skip AI-proposed density, unit weight, and nutrition values per ingredient.
  - Unedited AI values are tagged with `# [LLM]` in `ingredients.yaml` to track provenance.
  - Added `--report` (`-r`) to preview needed database enrichments without writing changes, matching `gram db lint --report` (replaces `--dry-run` / `-n`).
  - Added `--yes` (`-y`) to accept all estimates automatically for non-interactive scripting.
  - Automatically falls back to accepting values with a warning when executed in non-interactive (non-TTY) environments.
- **CLI / Import**: Added integrity guardrails and diagnostic reporting to `gram import`:
  - Validates compiled AST tokens against AI output to detect lost ingredients or truncated steps, aborting instead of writing corrupted files (overridable with `--force`).
  - Reports uncorrected AI generation errors with actionable diagnostics.
  - Identifies imported ingredients missing quantities and lists their line numbers for easy manual completion.
  - Reports unknown database ingredients and unweighed units when an ingredient database is present.
  - Prevented hallucinated placeholder metadata in `author:` and `source:` fields.
  - Redirected progress indicators to `stderr` so stdout redirection (`gram import ... > recipe.gram`) produces clean recipe files.
- **Nutrition & Rendering**: Support flexible nutrition serving bases (per portion and per 100 g) alongside whole-recipe totals:
  - Declaring `portions:` in recipe frontmatter now calculates per-portion nutrition and keeps values constant when scaling recipes.
  - Added a standardized `per-100g` nutrition basis calculated from raw assembled recipe mass.
  - Added the `--nutrition <auto|total|per-portion|per-100g>` option to `gram view`, `gram export`, and `gram print`.
  - Added nutrition basis toggles in the web playground and VS Code live preview.
  - Localized all nutrient names and table headers across supported languages (French and English).

### Bug fixes and improvements
- **Parser & Kitchen**: Fixed an issue where multi-word composite ingredients marked with `&` (e.g. `@juice{1}<@&unwaxed lemon{}`) were duplicated in the shopping list instead of being combined into a single purchase item.
- **Analyzer & Language Server**: Improved nutrient calculation completeness and editor hover precision:
  - Saturated, monounsaturated, polyunsaturated fats, and alcohol are now included in recipe nutrition totals instead of being omitted.
  - `gram db enrich` can now propose monounsaturated and polyunsaturated fat values during ingredient enrichment.
  - Fixed the editor hover tooltip incorrectly displaying sodium in grams instead of milligrams.
- **Analyzer**: Fixed recipe total mass and section weights to include ingredients defined as relative percentages of another ingredient (e.g. `@water{60% @&flour}`).

---

## [1.0.1](https://git.gram-lang.org/gram-lang/gram/compare/v.1.0.0...v.1.0.1) - 2026-08-07

### Bug fixes and improvements
- Fixed the `--help` description of `gram check` to clarify that it also checks database completeness by default, unless `--skip-db` is used.
- Reduced the AI provider costs of running `gram import`:
  - Prompt caching is now enabled, so retries reuse the cached prompt instead of paying full price.
  - The command now sends a minimized recipe payload instead of the full raw webpage data.
  - The self-correction loop no longer spends retries on informational warnings (like missing database ingredients).
  - Formatting is now handled locally instead of spending an AI call to fix it.
- Improved the quality and correctness of recipes generated by `gram import`:
  - Fixed an issue where English words would leak into non-English recipes.
  - Fixed grammatical errors (dropped articles) around ingredient and cookware references in non-English output.
  - Descriptive adjectives (like "boneless skinless") are now correctly extracted as preparation steps instead of creating unwieldy ingredient names.
  - Corrected the generated syntax for multi-word cookware references.
  - Fixed an issue where the target language was sometimes incorrectly inferred.
  - Improved decoding of accented characters and punctuation from the source recipe.
- Improved the CLI guidance printed after running `gram import`:
  - It now correctly points to `gram db sync` as the recommended next step.
  - It accurately reports any remaining compiler warnings (e.g., missing ingredients) instead of silently discarding them.
- Fixed `gram init` to ensure the interactive AI provider setup accurately offers the currently recommended models (e.g., llama4).

---

## [1.0.0](https://git.gram-lang.org/gram-lang/gram/compare/v.1.0.0-beta.5...v.1.0.0) - 2026-08-06

### Breaking changes
- Gram v1.0.0 Official Launch! 🎉 This milestone release marks the official 1.0.0 launch of Gram:
  - **Brand-New Website & Documentation**: Rebuilt using Astro and Starlight with refined guides and an integrated blog.
  - **Refreshed Visual Identity**: Brand-new logo.
  - **Infrastructure & Stability**: Monorepo stability, test coverage, and migration to new Forgejo (`git.gram-lang.org`) mirrored to GitHub and Codeberg.

---

## [1.0.0-beta.5] - 7/26/2026

### New features
- Introduce `@gram-lang/format`, a standalone canonical code formatting engine for `.gram` files with 13 deterministic rules, used by the CLI and Language Server.
- `convertUnit`, `standardizeMass`, and `analyze()` now accept an optional `lang` parameter/option, so unit names are resolved against the recipe's own language when there's an ambiguity between languages, instead of always falling back to a single global guess. `UNIT_CONVERSIONS` (the mass/volume conversion table) has moved to `@gram-lang/i18n` — if you imported it from `@gram-lang/analyzer`, import it from `@gram-lang/i18n` instead.
- The `language:` setting in `.gram/config.yaml` now also affects unit conversion and the shopping list's category order (e.g. a database with French category names like "Légumes" now sorts correctly when `language: "fr"` is set) — previously it only affected AI-generated content.
- Fixed two bugs in the recipe formatter:
  - A `#cookware` reference at the very start of a line (e.g. `#pan(20cm)`) was incorrectly treated as a malformed section header and got a space inserted after the `#`, turning it into plain text and silently breaking the recipe.
  - Blank-line spacing before a `## Section` header was being promoted to two blank lines instead of Gram's actual convention of exactly one blank line between every step and/or section. The formatter now consistently enforces a single blank line everywhere, including before section headers. As a result, the `sectionSpacing` counter (previously reported alongside `consecutiveBlankLines`) has been removed — this kind of spacing fix is now reported as part of `consecutiveBlankLines`.
- `@gram-lang/i18n` now also owns the numeric conversion factors for units (grams, milliliters, etc.) and time (minutes, hours, etc.), exported as `UNIT_CONVERSIONS` and `TIME_TO_MINUTES` — previously split across `@gram-lang/analyzer` and hardcoded inside `@gram-lang/kitchen`. No behavior changes; this just puts everything about units and time in one place.
- Food categories now have stable, language-independent keys (`CATEGORY_KEYS`, `CategoryKey`, `getCategoryLabels`, `isCategoryKey`) instead of only translated display labels. This means `gram db enrich` now stores a category identity that stays consistent regardless of your configured language, rather than a French or English label baked in at write time.
- The Markdown, HTML, and printable/PDF outputs now show the same information consistently:
  - Markdown recipes now include a nutrition summary (calories, carbs, protein, fat, etc.), which was previously only shown in HTML and print.
  - Recipe comments now appear as numbered footnotes in Markdown and print output too, instead of only in HTML.
  - When a shopping-list ingredient's purchasing weight differs from what actually goes in the bowl (e.g. "1 avocado" vs. its usable flesh), Markdown and print now show the extra "gross weight" note, matching HTML.
  - When the same ingredient appears in incompatible units that can't be combined (e.g. "100g" and "1 cup" with no density available), Markdown and print now group them together with a "mixed units" warning, matching HTML.
- `gram format` and the editor's "format on save" now share the exact same formatting rules, so a recipe formatted by one always looks identical when opened in the other. This adds a few new automatic cleanups to both: normalizing spacing around composite ingredients (`@a{} < @b{}` → `@a{}<@b{}`), tidying up intermediate-result declarations (`->&name {}` → `->&name{}`), making sure section headers have exactly one space after the `#`s, and converting tabs to spaces.
- Add an interactive Gantt Chart view to the VS Code extension and export reusable Gantt chart rendering helpers (`toGanttHTML`, `attachGanttInteractivity`) from `@gram-lang/renderer`. Provides a real-time timeline visualization of recipe steps, background timers, and target serving times directly in your editor and the web playground.

### Bug fixes and improvements
- Fixed a bug where the wrong API key could be sent to the wrong AI provider. If you had, say, `GEMINI_API_KEY` set in your environment but configured `provider: openai` in `.gram/config.yaml`, your Gemini key could be sent to OpenAI instead. Each provider now only ever uses its own key.
- Baker's Percentage is now shown on an ingredient's inline mention within step text, not just in the recipe's ingredient list and shopping list — a dead type check meant this data was computed but never actually reached the inline token.
- The ingredient database schema no longer requires `density` on every entry that has a `physical` block — an ingredient described only by `unit_weight` (e.g. "1 avocado") is valid, matching the analyzer's own documented example. Previously, `gram db enrich` could write entries that `gram build`/`gram db validate` would then reject.
- `gram diff` (and `diffRecipes`) now detects quantity changes inside composite ingredients (`<@parent`) and alternative groups (`@a|@b`), which it previously ignored entirely — a recipe that doubled a composite or alternative's quantities used to be reported as having no changes at all. It also no longer loses one of two same-titled sections, or two same-named timers/temperatures within a single section, when comparing two recipes.
- Fixed the same ingredient sometimes getting two different `normalizedMass` values in one analyzed recipe (e.g. `250.78328000000002` in a recipe section vs. `250.78` in the shopping list) — the section-level and composite-child mass calculations now go through the same rounding as the shopping list, instead of duplicating the sequence without it.
- Removed all uses of `any` from the physical/nutrition analysis layer's internal types, typing them against the real shapes already exported by `@gram-lang/kitchen` and this package's own `AnalyzedUsage`/`NutritionItem`. No behavior change for this package beyond the fixes already released separately (see the relative-quantity type changeset). The renderer's printable/PDF view gained one internal `any` to stay compatible with the analyzer's now-stricter shopping-list type — purely a type-level adjustment, no output change.
- A relative-quantity ingredient's resolved quantity (e.g. `@water{50% @&flour}`) is now tagged with the correct `"single"` type instead of a value that didn't match any of the documented quantity shapes — it happened to still render correctly today only because of an unrelated fallback, so this is a safety fix rather than a visible change.
- Fixed a major parsing bug where a bare `@ingredient` or `#cookware` mention (one written without its own `{}`) would silently swallow an unrelated timer, temperature, cookware, or ingredient that appeared later on the same line into its own name, if that later element happened to close with a valid quantity — losing that element from the recipe entirely. For example, `Brown the @&chicken for ~{3min}.` used to lose the timer completely, turning it into a single ingredient named "chicken for ~". Both the ingredient and cookware name now stop at the same sigils (`@`, `#`, `~`, `^`, `&`) that a bare reference (`&name`) already correctly stopped at.
- Warnings about invalid ingredient database entries now go to stderr instead of stdout, so commands like `gram build recipe.gram | jq` no longer break when the database has a bad entry.
- `gram shop` now groups the shopping list by the same category names used everywhere else in the project (e.g. "Seafood" instead of "Fish", "Vegetables" instead of "Produce") instead of its own inconsistent list.
- Fixed `gram format` rewriting values inside the recipe's frontmatter (the `---` metadata block at the top of a `.gram` file). For example, an email address like `Jean@Example.com` in `author:` used to get incorrectly lowercased to `Jean@example.com`. Frontmatter is no longer touched by formatting rules meant for the recipe body. File writes are also now atomic and lock-protected, matching the rest of the CLI.
- Fixed several French unit words silently resolving to the wrong physical quantity:
  - `quart`/`quarts` no longer resolves to the US liquid quart (946 mL) in French recipes — it's a false friend ("un quart d'heure" means "a quarter of an hour", not a unit of volume). It's now reported as an unknown unit instead of silently misinterpreted. The English word `quart`/`quarts` still works in English recipes; only the spelled-out alias was removed, `qt` still works everywhere.
  - `livre` now converts using the French "livre métrique" (500 g) instead of being silently treated as the imperial pound (453.592 g) — a ~10% error.
  - `tasse` now converts using the French cup (250 mL) instead of being silently treated as the US cup (236.588 mL) — a ~6% error.
  - `pinte` no longer resolves at all: the historical French pinte has no single reliable modern value, so an explicit "unknown unit" is better than a confident-looking wrong number.
  - `gallon`/`gallons` now resolve correctly (previously only the abbreviation `gal` worked).
- The compiler now detects indirect circular dependencies between section intermediates (e.g. section A's result depends on section B's, whose result depends back on section A's) and reports a `CIRCULAR_REFERENCE` warning for each one — previously only a direct self-reference was caught.
- Removed all uses of `any` from the compiler's internal types, replacing them with the real shapes already exported by the package (`Usage`, `CompositeItem`, `StepToken`, etc.), and cleaned up dead code paths in shopping-list aggregation.
- Scaling a recipe by an extreme factor now fails with a clear error instead of silently producing `Infinity` (serialized as `null` in the output JSON). Scaled quantities are also rounded consistently, including a composite ingredient's total, so results no longer show float noise like `110.00000000000001`.
- Scaling a fraction quantity (e.g. `1/2 cup`) no longer produces a malformed value in the compiled JSON (`{"type": "fraction", "value": 1}` with no numerator/denominator) — it's now correctly represented as a plain numeric quantity.
- Fixed several compiler correctness bugs:
  - An empty section (or one containing only a comment) between two sections with steps used to break ALAP scheduling: the step right after the gap could get scheduled to overlap a timer still running from before the gap. It now correctly chains past the gap.
  - `applyScale()` (used by `gram scale` and the playground) now scales cookware quantities. Previously it only scaled cookware "by accident" when called from inside `compile({ scaleFactor })`, so `applyScale(compile(recipe), factor)` silently left cookware unscaled.
  - A timer with an unrecognized time unit (e.g. `~{3 bananas}`) or a missing unit no longer silently contributes a fabricated duration to the recipe's total/active time. Both now raise a warning instead, matching how temperatures and retro-planning already behave.
  - Timer units are now displayed consistently (e.g. always "min", never a mix of "min"/"mins"/"minutes" for the same physical duration in the same recipe).
- Fixed a spurious `TRACK_CONTENTION` warning on the ordinary, intended use of named passive tracks (`~_name{...}`) — chaining several steps on the same physical resource (an oven, a fridge shelf) back-to-back no longer warns just because nothing else linked those steps together. The scheduler now understands that shared-track ordering the same way it already understands `&intermediate` dependencies, so the warning only fires when a real, unforeseen conflict remains.
- Fixed several ways the language server could crash the whole editor session instead of just failing gracefully: a malformed entry in `ingredients.yaml` (e.g. missing `name`) no longer crashes the server, opening a project in a virtual or remote workspace no longer crashes initialization, and a failed background database reload can no longer take down the process. Formatting, rename, and code actions also now always operate on the current document content instead of a possibly-stale cached version.
- `ASTNode` is now a fully exhaustive, discriminated union that matches what the parser actually produces (`CompositeAST`, `QuantityAST`, `TextQuantityAST`, and `RelativeQuantityAST` were previously missing from it), and composite ingredients (`<@parent`) now carry source location info like every other node. Making these types honest surfaced and fixed three real bugs in the language server: outline (document symbols), syntax highlighting (semantic tokens), and go-to-definition/rename/hover (reference and intermediate lookups) could silently miss or crash on content that isn't wrapped in a `## Section` header — a recipe with no headers at all, or with a comment before the first header.
- Fixed two silent quantity-corruption bugs in fraction parsing: a decimal numerator (e.g. `1.5/2`) used to be truncated to an integer before dividing, silently turning `1.5/2` into `0.5` instead of `0.75`; a zero denominator (e.g. `1/0`) used to produce `Infinity`, which serializes to `null` in JSON, instead of being rejected outright.
- The `hideStepQty` rendering option (hides ingredient quantities from step text) now works with `toHTML` and `toMarkdown`, not just `toPrintHTML` — it was previously silently ignored by the other two.
- Fixed an HTML injection vulnerability (XSS) in `toHTML`'s timing-card tooltips: a section title or named timer containing HTML would render unescaped in the "Active Time" / "Total Time" tooltips, exploitable via the playground or the VS Code preview. Both are now properly escaped like every other text field.
- `toHTML`, `toMarkdown`, and `toPrintHTML` now type their `data` parameter instead of accepting `any`. Typing it surfaced two real bugs, now fixed: the HTML nutrition panel's "incomplete data" warning was never actually shown (it read a field that never existed, always showing a blank 0-calorie panel instead), and the printable/PDF view displayed sodium in grams instead of milligrams (1000x too high).
- Fixed syntax highlighting (TextMate grammar): a bare `@ingredient`, `#cookware`, or `<@parent` mention with no `{}` of its own would have its highlighted span incorrectly extend all the way to the next unrelated `{...}` on the line (e.g. a later `&reference{}`), coloring everything in between as if it were part of the same name. The name-matching patterns now stop at `@`, `#`, `~`, `^`, and `&`, the same sigils the compiler itself stops at.
- `toMarkdown` now neutralizes raw HTML (`<` and `&`) in recipe titles, ingredient names, and step text. Previously, a recipe containing something like `<img onerror=...>` in its title would pass through untouched, which could run as a script if that Markdown was later converted to HTML — this is now escaped automatically, closing that gap for imported or shared recipes.
- `gram import <url>` now refuses to fetch addresses that aren't publicly routable (localhost, private networks, link-local/cloud metadata addresses), including on redirects — closing a way for a malicious or compromised page to make the CLI fetch internal network resources. API keys stored via `gram init`/`gram config set` are now actually picked up when running the CLI under Node (previously only worked when run via Bun). `gram db enrich` now clearly reports when nothing was written to disk instead of claiming success; AI-suggested ingredient values that are physically implausible (like an ingredient density far outside any real food) are now rejected instead of being written to your ingredient database.
- `QuantityValueAST` (the parser's internal representation of a parsed number/fraction/range) is now a proper discriminated union instead of a flat interface with every field optional. This is an internal type-safety improvement with no behavior change — it's what would have caught, at compile time, a real bug fixed earlier in `diffRecipes` (checking `qty.from`/`qty.to`, fields that never existed on any variant).

---

## [1.0.0-beta.4] - 7/23/2026

### Breaking changes
- Section retro-planning (e.g. `## Section ~{-2h}`) now enforces a strict signed-duration syntax instead of accepting arbitrary free text, preventing invalid timeline calculations. Added support for the `d` (day) time unit.

### New features
- Added support for ALAP (As Late As Possible) scheduling. Passive timers and their dependencies are now natively pushed backwards from the end of the recipe, ensuring ingredients are prepared just-in-time rather than sitting idle on the counter. Also introduces two new compiler warnings for timeline conflicts: `TIME_PARADOX` and `TRACK_CONTENTION`.
- Exported the `runPipeline` function alongside its associated types from `@gram-lang/cli` to facilitate library and programmatic usage of the core compiler orchestration.
- Renamed the `cookTime` metric to `idleTime` across the ecosystem to better reflect hands-off wait time. Additionally, passive timers sharing the same name are now automatically sequenced one after another on the same background track.
- Added `llms.txt` and `llms-full.txt` to the documentation site, providing a curated index and full concatenated specification tailored for AI assistants and agents.

### Bug fixes and improvements
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

### Bug fixes and improvements
- `gram check` now resolves syntax error line numbers from the parser's structured `GramParseError.offset` instead of regexing "line N" out of ohm's prose message — line numbers are now always correct, not just when they happened to match that pattern.
- Downgrade minimum VS Code version requirement to 1.75.0
- Updated deployment configuration to automate npmjs packages publication
- Updated docs for clarity and accuracy.

---

## [1.0.0-beta.2] - 7/13/2026

### Breaking changes
- fix!: load valid ingredients even when the database has a bad entry, and fix five correctness bugs
- fix!: `gram check` only fails on structural errors by default (use `--strict` for the old behavior), fix LSP completion race, and add ingredients.yaml live reload
- feat!: validate and normalize temperature units, add a shared warning severity map, and fix accented/non-Latin ingredient slugs
- feat!: replace the `°` temperature sigil with `^`, the `~&` passive timer marker with `~_`, and add mixed/Unicode fraction support

### New features
- Added a bilingual (EN/FR) "API Reference" section covering the programmatic API of `@gram-lang/parser`, `@gram-lang/kitchen`, `@gram-lang/analyzer`, `@gram-lang/renderer`, and `@gram-lang/i18n` — function signatures, options, JSON data formats, and the full warning-code catalogue. Reference tables (warning codes, AST node types, unit conversions, categories) are generated at build time directly from each package's source, so they can't drift out of sync with the code. Also fixed an incorrect `analyze()` call example in `how-to/build-custom-ui.md`.
- Export `fetchRecipe` and `validateGram` from the recipe-import service, enabling direct testing and reuse of the import validation pipeline.
- Add `round2(value: number): number`, exported from `@gram-lang/kitchen`. It centralizes the 2-decimal rounding rule (`parseFloat(x.toFixed(2))`) previously duplicated across kitchen, analyzer, and renderer, giving quantity/mass rounding a single documented implementation. No observable output changes — same rounding rule as before, just in one place.
- `getAST` now throws `GramParseError` instead of a plain `Error` on syntax errors. This new error type includes structured fields (`offset` and `expected`) while preserving the original human-readable message. The language server now uses the `offset` field to report parse-error diagnostics at their exact location in the document, rather than defaulting to line 1 column 1.
- The playground now shows a red squiggly marker at the exact location of a syntax error using the new `offset` field. Fixed a crash in the playground on mount in real browsers caused by an aggressive automated lint fix that removed necessary Vue `<template>` bindings and component imports.
- `toHTML` no longer stamps footnote anchor ids with `Math.random()`. Output is now deterministic by default (ids like `note-1`), which is required for byte-stable golden/conformance testing. If you render multiple recipes on the same page and relied on random ids to avoid anchor collisions, pass a new `renderId` option (e.g. a recipe slug) to disambiguate.
- Upgraded all monorepo dependencies to their latest versions and implemented a TypeScript 7 dual setup for faster typechecking while preserving compilation toolchain compatibility. Fixed type errors arising from Node 26 and VS Code LSP v10 updates.

### Bug fixes and improvements
- Added a global `--verbose`/`--debug` flag (works with any subcommand) that prints the full stack trace alongside the usual terse error message — useful when filing a bug report or diagnosing an unexpected failure.
- Fix `_usageId` leaking a global counter across separate `compile()` calls in the same process (affected the language server and `gram scale`'s parallel compiles, making ids non-deterministic for an unchanged recipe). Fix nutrition analysis always reporting `isEstimate: true` regardless of actual data precision. Fix the section mass badge in HTML output missing its scale icon.
- Fixed a regression introduced alongside the new `--verbose` flag where `gram -v` stopped printing the version and showed the help text instead (`-v` is citty's own `--version` shorthand — it's no longer swallowed as part of the verbose flag). Also fixed `gram import`'s fetch timeout message not showing up when the timeout fires while reading a slow response body instead of during the initial connection.
- `.env` is now written with `0600` permissions instead of the OS default, so API keys are no longer group/world-readable on shared machines. `.gram/config.yaml` is now validated at load time (invalid fields fail with a clear error instead of crashing deep in the pipeline). `gram import` now times out after 15s, caps response bodies at 10MB, and asks for confirmation before writing AI-converted content from an untrusted external source to disk (skippable with `--yes`).
- Performance improvements for CLI tools: - `gram format` now processes files concurrently, significantly speeding up execution on large recipe collections. - `gram db sync` now uses a length-based pre-check for fuzzy matching to speed up similarity comparisons against large databases.
- Fixed a bug in `applyScale()` where scaled quantities were incorrectly squared instead of multiplied for inline step ingredients, resulting in incorrect values (e.g., displaying `800g` instead of `400g` when using `--scale 2`). The aggregated shopping list was unaffected.
- chore: declare `sideEffects: false` so bundlers can tree-shake unused exports from these packages No package previously declared this, so third-party bundlers had to assume every module might have side effects and couldn't safely drop unused code.
- fix: sync TextMate grammar with the `^`/`~_` sigil changes and stop mis-highlighting invalid temperature units - Updated TextMate grammar to use `^` (Temperature) and `~_` (Passive Timer) sigils. - Temperature unit highlighting now mirrors the compiler's whitelist (e.g., `180C`/`180°F`). Invalid units now receive a distinct `invalid.illegal.unit.gram` scope. - Name matching now correctly stops at the new `^` sigil.
- Compiler warnings (`CompilationResult.warnings`, `NutritionMetrics.warnings`) are now always structured `Warning` objects (`{ code, message, item?, loc?, section? }`) instead of sometimes being plain strings depending on call order — a latent inconsistency that could previously produce `"[object Object]"` in some rendered output. `Usage.composite`, `Usage.options`, and `ProcessedStep.content` are now properly typed instead of `any`. Also fixes range-based timer quantities (e.g. `~{5-10min}`) never displaying correctly in `gram diff` output, due to a pre-existing typo checking non-existent fields.

#### Breaking
- `validateIngredientDatabase` no longer throws an error on a single malformed entry. It now validates entry-by-entry, returning both valid data and rejected keys. This prevents `gram check` or `gram cook` from hard-failing due to one unrelated bad line.
- `physical.yield` must now be `> 0` (previously `>= 0`) to prevent producing `Infinity` mass downstream.
- `gram check` now only fails on structural issues (like undefined references) and uses a shared `warningSeverity` map. Nutritional gaps and incomplete annotations are reported as warnings instead of failing the build. Use `--strict` for the old all-warnings-fail behavior.
- `GramConfigError` exit code changed from 2 to 1 (user error, not internal crash).
- The Temperature sigil is now `^` (e.g. `^{180C}`). `°` is no longer a block-opening character, but remains valid inside unit spellings (`°C`).
- The Timer passive marker is now `~_` (e.g. `~_{45min}`) instead of `~&`.
- Temperature units now accept bare `C`/`F` in addition to `°C`/`°F`.

#### Fixed
- Added a guard in `applyYield` against non-positive yield factors.
- Shopping list aggregation: The `optional` modifier is now treated as an intersection rather than a union.
- `diffRecipes`: Temperature ranges that change bounds but keep the same average are now correctly detected in the diff. Fixed an issue where identical section titles would drop timer/temperature tokens.
- `calculateMassMetrics`: Excludes `optional` ingredients from `totalMass` to match nutritional calculations.
- `calculateNutrition`: Missing nutrient data now propagates as `undefined` rather than an indistinguishable `0`.
- Language Server: Fixed a race condition where completions immediately after `@` or `&` could return nothing.
- Language Server: Diagnostics now correctly use the shared `warningSeverity` map.
- Language Server: `ingredients.yaml` is now actively watched via LSP. External edits instantly refresh diagnostics without restarting the editor.

#### New syntax
- Added support for mixed-number fractions (`1 1/2`) and Unicode vulgar fraction glyphs (`½`).

#### Kitchen
- `warningSeverity`: a new exported map to separate structural errors from recoverable warnings.
- Temperature units are now validated and normalized to canonical `°C`/`°F`.
- `slugify` now preserves non-Latin letters via `\p{L}`/`\p{N}`.

#### Analyzer
- Fixed `parseDensityOverrides` name normalization for accented ingredient names.

---

## [1.0.0-beta.1] - 7/5/2026

### Breaking changes
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

### New features
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

### Bug fixes and improvements
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

### Breaking changes
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

### New features
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

### Bug fixes and improvements
- NutritionMetrics output field renamed from `salt` to `sodium` to match the ingredient database schema

---

## [0.10.1] - 6/14/2026

### Bug fixes and improvements

- Cleaned up and updated dependencies.
- Implemented Turborepo to optimize and simplify project building.

## [0.10.0] - 6/14/2026

### New features
- Added Bun snapshot testing to the development environment for compiler validation.
- Created a new shared @gram-lang/renderer package to handle HTML and Markdown generation.
- Refactored unit translation and normalization into a new centralized @gram-lang/i18n package to remove redundancy between the compiler and analyzer.

### Bug fixes and improvements
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

### New features
- Ingredients states (`@ingredient:state{}`) are removed. While the idea was to better organize the ingredient's database, it just happened to be too confusing to use.
- Updated unit resolution to allow for french aliases (e.g: tsp = càc)
- Ingredient references without quantities (`@&ingredient{}`) are now excluded from section ingredients summaries. This keeps section-level mise en place lists clean by filtering out pure flow instructions (like removing or re-inserting) while preserving separate measured portions.
- Fixed multiple issues with mass calculations
- Extracted analyzer logic (mass normalization, yield management, nutritional estimation) into its own package. Ingredients database must now be provided by the user.
- GRAM syntax now also accepts semantic temperatures (e.g: Cook on !{low heat})

### Bug fixes and improvements
- Cleaned repo with removal of /dist folders
- Using changesets to simplify changelog management
- Clarification of global comments for a recipe, to be declared in the front matter as "notes"
- Removed unwanted spaces from default playground input
- Empty ingredient masses now count as zero.

---
