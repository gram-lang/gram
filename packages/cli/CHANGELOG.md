# @gram-lang/cli

## 1.4.0

### Minor Changes

- 9737e58: **Analyzer / Diff**: `gram diff` now compares the total and idle times of the default schedule, with the mise en place right before each section, so the times it reports match what `gram view` shows by default; the active time is the schedule's too, so changing the range of a cooking time (`~{20-25min}`, planned on its longest figure) shows in the comparison, and the preparation time is compared as before
- 4be3d19: **CLI / View & Export**: `gram view`, `gram export` and `gram print` accept a new `--mise-en-place <per-section|upfront|per-day>` option, to see the recipe with the mise en place planned right before each section (the default), all at the start, or at the start of each working day:

  - The total and idle times shown follow the chosen option; the active and preparation times stay the same
  - A new `--rests <shortest|balanced|longest>` option does the same for a wait written as a range (`~_{12-24h}`): the shortest by default, the middle or the longest, in the total time as in the length shown on the step itself
  - `gram cook` accepts both options too, for the total time it shows; `--rests` also sets how long the timer of such a wait runs

- ea80164: **CLI / Plan**: A new `gram plan <recipe>` command plans a recipe: the days of work, the visits to the kitchen, what to take out and which steps of each section to read:

  - `--serve "2026-10-11 13:00"` plans it backward from the time it is served; without it, the plan is told in days before the service (D-2, D-1, day D) and ends with the earliest time it could be ready if you start now
  - `--tz Europe/Paris` sets the time zone; by default it is the new `timezone` setting of `.gram/config.yaml` (or of your global config), and only then this machine's. `--available` says when you can cook, as many times as needed: `08:00-22:00` for every day, `fri=18:00-22:00` for a day of the week, `2026-10-09=none` for a date. By default it is the new `availability` setting of `.gram/config.yaml`, written the same way (`gram config set availability 08:00-22:00`), and only then all day
  - A wait written as a range (`~_{8-16h}`) is made longer or shorter to keep your own work out of the hours you are not available, and the plan says which one and why; what cannot be fixed is listed at the top
  - `--find 2026-10-12/2026-10-15` lists the serving times that work between two moments, at your meal times (`--meal-times 12:30,20:00`, or the new `mealTimes` setting of `.gram/config.yaml`), best first, and why each of the others does not
  - A date that does not exist (`--serve "2026-02-30 20:00"`, a 31st of April in `--find` or `--available`) and a `--now` that cannot be read are refused with a message saying what is expected, instead of planning for another day or stopping with an internal error
  - `--format text|md|html|json` picks the output, and `--ics plan.ics` also writes a calendar file with an event for every visit to the kitchen, an alarm before it, and the lists in its description
  - `--mise-en-place`, `--rests`, `--scale` and `--stock` work as they do in `gram view`; the mise en place mode also decides what goes in each visit's list of things to take out
  - `gram export` and `gram print` render the run sheet instead of the recipe via `--view run-sheet` (the recipe remains the default), supporting `--serve`, `--tz`, and `--available`; without `--serve`, the schedule is organized in relative countdown days (`D-2`, `D-1`, `Day D`). The print document formats one day per page, and `gram export` automatically outputs to `<recipe>.run-sheet.md` (or `.html`, `.txt`) unless `--output` is specified
  - `gram export --view run-sheet --format text` writes the run sheet as plain text, as `gram plan` prints it. Each view offers only the formats it has: asking the recipe for `--format text` says which formats it offers instead of writing something else

- a20f506: **CLI / Settings**: Every setting of a recipe now has a flag named after it, on every command where it changes something, with the same values and default as in the editor and the playground:

  - `--step-quantities show|hide` on `gram print` and `gram export` chooses whether the quantities are written in the text of the steps (replaces `--no-step-qty`, which still works)
  - `--nutrition-basis` is the new name of `--nutrition` on `gram view`, `gram print` and `gram export` (`--nutrition` still works)
  - What the analyzer computes can now be turned off on `gram view`, `gram print`, `gram export`, `gram cook`, `gram build`, `gram watch` and `gram shop`: `--no-mass-standardization`, `--no-yield-calculation`, `--no-nutrition-estimation` and `--no-bakers-math`; everything stays on by default
  - An unknown value stops the command and lists the values it accepts, under the name you typed

- 7165632: **CLI / View**: `gram view` now shows the recipe the way every other view of Gram does, and in your language:

  - The headings, the labels and the nutrition follow the language of your project, instead of always being English
  - The text of each step repeats the quantity next to each ingredient (`flour (200 g)`), as in the exported recipe; `--step-quantities hide` (or `--no-step-qty`) leaves them out
  - Comments are shown, as notes under the recipe; `--comments hide` leaves them out
  - An ingredient with an alternative is written in full (`egg or egg substitute`) where it used to read "alternative", a section brought in from another module says where it comes from, and a nutrition table with nothing in it is no longer printed
  - A wait written as a range (`8-16 h`) is shown as written, and the duration the schedule retains is left to the run sheet, so the `(~8h)` that followed such a step is gone
  - The colors follow your terminal: nothing but plain text is written when the output goes to a file or another command, `NO_COLOR` is respected, and `FORCE_COLOR=1` keeps them for `gram view | less -R`

- c653893: **Comments**: You can now choose whether the comments of a recipe (`// like this`) are shown or left out, in every view:

  - The renderer takes a new `comments: "show" | "hide"` option (default `"show"`): the recipe views, the print and the run sheet all follow it, and hiding leaves no empty notes section behind
  - `gram export`, `gram print` and `gram plan` accept `--comments <show|hide>`
  - A new `gram.comments` setting does the same for the VS Code preview and run sheet, and the playground gets a **Display** section with a switch
  - In the run sheet, comments are set apart discreetly: a note alone on a line sits under its step in small muted text, and one at the end of a line stays in the sentence, between parentheses

- dc6899d: **Nutrition & Rendering**: The nutrition of the HTML recipe is now a compact table, like a European food label, and easy to reach from the top of the recipe:

  - One column per basis, side by side (per 100 g, then per portion), with the energy as the first row in kJ and kcal and the whole recipe underneath; no more switching between bases
  - A `%RI` column gives each nutrient's share of the reference intake of an average adult (8,400 kJ / 2,000 kcal), per portion
  - The hero bar shows the energy (`493 kcal per portion`, or per 100 g when the recipe declares no portions); clicking it jumps to the table
  - Sodium is now shown as salt, in grams (sodium × 2.5), and calories as energy, in every view and every language: the HTML and printed recipe, Markdown, plain text and the terminal
  - With the `nutritionBasis` setting set to one basis, the table and the hero bar show that basis alone
  - The Markdown and plain text recipes show the same table by default (per 100 g and per portion side by side, the `%RI` column and the whole recipe underneath), instead of the values per portion only
  - **Deprecated**: the `interactiveNutrition` option of the renderer no longer has any effect, since every basis is shown at once. Remove it; it will be removed in 2.0.0

- 26171cc: **Rendering**: The recipe can now be written as plain text, for a terminal or a plain file:

  - A box with the title, the servings and the times, then the shopping list, the cookware, each section with its ingredients and its numbered steps, the notes and the nutrition, with the quantities lined up in a column
  - Every word is in the reader's language, and the text follows the same settings as the other formats (comments, quantities in the steps, baker's percentages, nutrition basis, mise en place and rests)
  - `gram export --format text` writes it next to the recipe (`brioche.txt`), and the playground offers it as a format of the recipe
  - The Markdown, HTML and print versions of the recipe now speak the reader's language too: "Instructions", "Ingredients", "Metadata", "Total Mass", "or", "optional", "passive" and the other words that were always in English now follow the language setting (`Étapes`, `Ingrédients`, `Métadonnées`, `ou`, `optionnel`... in French). The English output is unchanged, and the run sheet gets the same words
  - For developers: `toText()` and the `text` format of the recipe view; a `textStyle` option lets a terminal add its own colors, and `width` sets the width of the box and the rules

### Patch Changes

- 32927c6: **CLI**: Durations now read the same in `gram diff` and at the end of `gram cook` as in the rendered recipe (`1h 30min`, `45min`, `30s`), instead of a mix of `90 min` and `1h 30 min`.
- a8633be: **CLI**: Every command now stops on an unexpected error the same way: a one-line message instead of a stack trace, which `--verbose` still shows.
- 90af908: **CLI / Stock**: `gram view`, `gram cook`, `gram check`, `gram scale`, `gram export` and `gram print` now warn on stderr when a `--stock` entry matches none of the recipe's `@use`, as `gram build` and `gram shop` already did, instead of ignoring it silently — most often a relative path typed from another directory, since it is resolved from the current directory
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
- Updated dependencies [c156d56]
- Updated dependencies [bdd85c5]
  - @gram-lang/analyzer@1.4.0
  - @gram-lang/renderer@1.4.0
  - @gram-lang/i18n@1.4.0
  - @gram-lang/kitchen@1.4.0
  - @gram-lang/scheduler@1.4.0
  - @gram-lang/modules@1.4.0
  - @gram-lang/format@1.4.0
  - @gram-lang/parser@1.4.0

## 1.3.0

### Minor Changes

- e0d0e9a: **CLI / Requirements**: The CLI now requires Node.js 22 or later (Bun keeps working as before).

  **Breaking**

  - **CLI**: Node.js 20 reached end of life in April 2026 and is no longer supported: upgrade to Node.js 22+ before updating the CLI

### Patch Changes

- 4c9652c: **CLI / View**: Fixed several display issues in `gram view` and cook mode:

  - Timers now show their real unit (`~{1h}` is shown as `~1h`, `~{20s}` as `~20s`) instead of always "min".
  - Recipe durations are rounded and readable (`1h 5m`, `25m 5s`) instead of raw decimals like `1h4.5`.
  - The resting time now appears in the recipe header.
  - Common fractions such as `1/4 tsp` stay fractions in the shopping list instead of becoming `0.3`.

- 48c856d: **Analyzer**: Fixed ingredients being ignored for density conversion and nutrition when their entry in `ingredients.yaml` isn't spelled exactly like the recipe name, such as "Huile d'olive" stored under `huile-dolive`:

  - Volumes like `@Huile d'olive{10ml}` are now converted to grams and no longer trigger "ingredient missing nutrition data"
  - `gram db lint` now reports ingredients whose names or aliases would be confused with each other

- Updated dependencies [4c9652c]
- Updated dependencies [a5891a9]
- Updated dependencies [48c856d]
- Updated dependencies [95698cc]
- Updated dependencies [fac320b]
  - @gram-lang/renderer@1.3.0
  - @gram-lang/modules@1.3.0
  - @gram-lang/analyzer@1.3.0
  - @gram-lang/parser@1.3.0
  - @gram-lang/kitchen@1.3.0
  - @gram-lang/i18n@1.3.0
  - @gram-lang/format@1.3.0

## 1.2.1

### Patch Changes

- Updated dependencies [532ea55]
- Updated dependencies [728e2ba]
- Updated dependencies [c8c4d49]
  - @gram-lang/renderer@1.2.1
  - @gram-lang/i18n@1.2.1
  - @gram-lang/analyzer@1.2.1
  - @gram-lang/kitchen@1.2.1
  - @gram-lang/modules@1.2.1
  - @gram-lang/parser@1.2.1
  - @gram-lang/format@1.2.1

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
