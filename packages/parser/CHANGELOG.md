# @gram-lang/parser

## 1.5.2

### Patch Changes

- daddb56: **Parser & VS Code**: A trailing colon after an ingredient (`Add @salt: `) is now kept in the step text instead of disappearing, and temperature names (`oven` in `^oven{180°C}`) are now highlighted like timer names in VS Code.

## 1.5.1

### Patch Changes

- **Parser**: Fixed syntax edge cases and parsing performance across empty files, headers, and inline elements:
  - Empty or blank-only files, as well as a trailing comment after `@use` without a final newline, now parse cleanly instead of failing or becoming a step.
  - Bare `##` headers now parse as untitled sections (instead of a `#` tool), empty `~{}` stays an anchor, and `->&dough ~{}` declares `dough`.
  - Symbol-only tokens (`##`, `@@`, `#~`, `&&`) and `&` followed by a space (such as `salt & pepper`) now stay plain text instead of creating phantom tools, ingredients, or references.
  - Actions (`[…]`), text temperatures (`^{…}`), and section anchors (`~{…}`) now end on their own line (leaving unclosed `[` or `^{` as plain text), while `/* … */` block comments still span lines.
  - Long quantity sums (`@flour{1 cup + 2 tbsp + …}`) now parse in linear time so they no longer slow down editors on every keystroke.
- **Parser & Format**: The parser and `gram format` now share the same rules for whitespace and line breaks:
  - Lines containing only spaces or tabs end a step just like empty lines, and trailing spaces or tabs on step lines are ignored.
  - Lone `\r` line breaks are recognized, a leading UTF-8 BOM is skipped by the parser and kept by the formatter, and non-ASCII spaces (such as non-breaking spaces) stay plain text.
  - `gram format` writes line breaks as LF without stripping non-ASCII whitespace.

## 1.5.0

### Minor Changes

- 073d4f1: **Parser & Kitchen**: An ingredient or intermediate quantity can now be written as a sum or difference of terms (`@flour{1 cup + 1 tbsp}`, `@sugar{1 cup - 2 tbsp}`, `@butter{1 cup + 20 g}`, `&dough{1 kg + 200 g}`):
  - Supports any number of `+`/`-` terms (including fractions and ranges) on ingredients, composite parents (`<@oranges{1 lb + 4 oz}`), and intermediates (including `@use` base yields); scaling multiplies each term, and `gram import` now preserves multi-measure sums instead of folding them into decimals.
  - Steps and section ingredient lists keep sums as written (`100 g + 100 g`), while scaled amounts format cleanly for cooking (`2 cup + 2 tbsp`, `2.4 kg`); compiled JSON stores terms in `parts` (with `minus: true` for subtraction) and totals in `qty`/`unit` (or full text in `unit` for mixed unit kinds).
  - Invalid sums (missing unit, percentage, multiplication, subtracting a range or across unit kinds, zero total) raise `INVALID_QUANTITY` with a suggestion in `data`; `OZ_AFTER_VOLUME` flags `oz` after a volume (`{1 cup + 2 oz}`), and `INVALID_UNIT` suggests a sum for adjacent quantities (`{1 kg 200 g}`).
  - Masses and nutrition weigh each term individually (returning no mass if any term cannot be weighed), `gram diff` shows formatted quantities via `fromText`/`toText`, `@gram-lang/renderer` exports `formatUsageQuantity`, and `@gram-lang/i18n` exports `termsTotal`, `mergeTerms`, `formatTerms`, and `Term`.
- e0f8fbf: **Parser & Kitchen**: Decimal numbers can now be written with a comma as well as a point (`{1,5 kg}` and `{1.5 kg}`):
  - Supported in all braced numbers (ingredients, ranges, relative quantities, cookware, temperatures, timers, and section anchors) and displayed in the reader's locale.
  - Commas followed by exactly three digits (`{1,000 g}`) are still read as decimals (`1 g`), with a new `AMBIGUOUS_NUMBER` warning in case a thousand was intended (while `{1.000 kg}` remains `1 kg` without warning).
  - `gram format` trims trailing zeros after a comma (`{1,50}` → `{1,5}`) while keeping `{1,000}` as written.
- 8d1b62e: **Parser & Kitchen**: Timers and section anchors now support natural duration syntax in English and French, with or without spaces:
  - Accepts compound durations (`~{1h30}`, `~{1 hr 30 mins}`, `~{1 heure 30}`, `~{1h + 30min}`, `~{2min30}`), clock notation (`~{1:30 h}`, `~{0:04:30}`), primes (`~{5'30"}`, `~{10'}`), ranges (`~{1h30-2h}`, `~{45 min - 1 h}`), section anchors (`~{-1h30}`, `~{-1j 12h}`), and aliases like `hr`, `hrs`, and `mn`. `gram import` now outputs these natural forms and avoids ambiguous notations like `~{1:30}`.
  - Ambiguous or invalid durations (`~{1:30}`, `~{1h75}`, reversed ranges) raise `INVALID_DURATION` with a suggested fix and are excluded from total time; anchor warnings now point directly to the anchor.
  - Compiled timers store the source text in `raw` and total minutes in `minutes` (normalizing `quantity`/`unit` to the smallest written unit for new forms) and are scheduled like any other timer.
  - Exposes `parseDuration` (`@gram-lang/i18n`) and `readAnchor` (`@gram-lang/kitchen`), and adds `loc` to AST section anchors.
- f91ec4e: **Parser & Kitchen**: Steps can now mark inline target states with an optional glued verification note (`Whisk until ={ribbon stage}(the batter falls back in a continuous ribbon).`):
  - Only the state sits inside `={…}`, with an optional single-line note attached to `}`; unclosed or empty `={` raises a syntax error, and braceless `@ingredient` names end before a target state (`@salt until ={taste}`).
  - Compiled steps emit a `checkpoint` token (`state`, plus optional `note`) without affecting scaling, scheduling, or the shopping list.
  - Rendered across HTML, Markdown, plain text, and print views; `gram cook` shows checkpoints below each step and reminds you when a step timer rings.
  - `gram diff` tracks added, removed, and changed target states, `gram import` preserves them from sources, and editors highlight them.
- 238e012: **Parser & Kitchen**: Temperatures can now carry a glued parenthetical note for oven mode or probe placement (`^{160°C}(fan)`, `^oven{180°C}(grill)`, `^{63°C}(internal)`, `^{high heat}(covered)`):
  - Only parentheses touching `}` on the same line are parsed as a note; spaced parentheses remain plain step text.
  - Displayed alongside the temperature in HTML, Markdown, plain text, print, and `gram cook` (which now formats temperatures consistently, including word-based ones like `^{high}`).
  - Adds an optional `note` field on AST and compiled JSON temperatures, tracks note changes in `gram diff`, and exports `formatTemperature` from `@gram-lang/renderer`.
  - `gram import` preserves oven modes as temperature notes rather than leaving them in prose.
- 55188fc: **Language Server & VS Code**: Editors now understand natural timer and anchor syntax:
  - Hovering a timer shows its normalized duration (`~{1:30 h}` → `1 h 30 min`), and hovering a section anchor shows its lead time and whether it starts a separate working day.
  - Unit completion inside `~{…}` suggests only time units (and no longer offers time units for ingredients).
  - Syntax highlighting distinguishes numbers and units in `~{1h30}`, `~{1:30 h}`, `~{5'30"}`, and duration ranges.
- d5fe9c3: **Parser, Kitchen & Analyzer**: Ingredients, intermediates, and timers can now be written as unit ratios:
  - Supports ratios across units or counts on ingredients (`@eggs{1 / 100 g @&flour}`, `@salt{15 g / 1 L @&water}`), homemade preparations (`&stock{250 ml / 100 g @&rice}`, plus percentages like `&stock{250% @&rice}`), and proportional timers (`~{15 min / 500 g @&roast}`, `~{4 min / @&cutlet}`).
  - Resolves compatible units at compile time and cross-family ratios via the ingredient database; incompatible or zero-denominator ratios raise `RELATIVE_QUANTITY_UNKNOWN_MASS` (with `reason`) or `INVALID_QUANTITY` (`reason: "zeroRatioDenominator"`) instead of guessing.
  - Whole-use references to a section preparation (`Roll out the &dough`) now estimate mass from the producing section, while step-produced intermediates (`Mix … ->&dough`) require an explicit amount (`reason: "stepProducer"`); warnings and formulas in imported bases display original author names rather than internal aliases.
  - Scaling a recipe re-resolves all ratios and recomputes the schedule, total times, and shopping list.
  - Views display resolved ratios in tooltips, and the language server provides syntax highlighting, target completion, intermediate renaming, hover previews, and inlay hints.

### Patch Changes

- 4d5f79f: **Parser & Kitchen**: Fractions with a zero denominator (`@flour{1/0 cup}`) now raise `INVALID_QUANTITY` (`reason: "zeroDenominator"`) and drop the invalid number (preserving it in AST `invalidNumber`) instead of silently misreading it.

## 1.4.2

### Patch Changes

- 6620c24: **Parser**: Fixed an unclosed parenthesis in a preparation note (such as `@flour{200g}(sifted and`) swallowing the rest of the recipe up to the next `)`, including later steps and sections. Preparations now stay on one line, so an unclosed `(` or a note split across lines is kept as plain step text.

## 1.4.1

### Patch Changes

- 4608f96: **Parser**: Section headers with leftover text after an anchor or intermediate (such as a multi-word `->&glazed rhubarb` missing braces) now raise a clear error instead of blaming the timer or turning the section into a step, and a section header on the last line with no trailing newline is now recognized.

## 1.4.0

No changes in this release.

## 1.3.0

### Minor Changes

- fac320b: **Parser & Kitchen**: Units written with abbreviation dots are now understood:

  - `{1/2 c.à.s}`, `{1 c. à c.}`, `{2 fl. oz.}` and similar spellings now parse and are recognized as the same unit as `càs`, `càc` or `fl oz`

  **Fixed**

  - **Parser**: A quantity in braces that can't be read (for example `@salt{1 g/l}` or a missing `}`) is now reported as an error pointing at the brace, instead of being ignored and merging the ingredient with others that share the same first word

### Patch Changes

- 95698cc: **Modules & Rendering**: Intermediates declared inside imported modules now show the name you wrote (for example `pressed`) instead of an internal path like `tofu$marinated$pressed`, in `gram view`, HTML and Markdown output.

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

## 1.1.0

### Patch Changes

- b3a509a: **Parser & Kitchen**: Fixed an issue where multi-word composite ingredients marked with `&` (e.g. `@juice{1}<@&unwaxed lemon{}`) were duplicated in the shopping list instead of being combined into a single purchase item.

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
