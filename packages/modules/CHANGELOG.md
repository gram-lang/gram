# @gram-lang/modules

## 1.5.0

### Minor Changes

- 073d4f1: **Parser & Kitchen**: An ingredient or intermediate quantity can now be written as a sum or difference of terms (`@flour{1 cup + 1 tbsp}`, `@sugar{1 cup - 2 tbsp}`, `@butter{1 cup + 20 g}`, `&dough{1 kg + 200 g}`):
  - Supports any number of `+`/`-` terms (including fractions and ranges) on ingredients, composite parents (`<@oranges{1 lb + 4 oz}`), and intermediates (including `@use` base yields); scaling multiplies each term, and `gram import` now preserves multi-measure sums instead of folding them into decimals.
  - Steps and section ingredient lists keep sums as written (`100 g + 100 g`), while scaled amounts format cleanly for cooking (`2 cup + 2 tbsp`, `2.4 kg`); compiled JSON stores terms in `parts` (with `minus: true` for subtraction) and totals in `qty`/`unit` (or full text in `unit` for mixed unit kinds).
  - Invalid sums (missing unit, percentage, multiplication, subtracting a range or across unit kinds, zero total) raise `INVALID_QUANTITY` with a suggestion in `data`; `OZ_AFTER_VOLUME` flags `oz` after a volume (`{1 cup + 2 oz}`), and `INVALID_UNIT` suggests a sum for adjacent quantities (`{1 kg 200 g}`).
  - Masses and nutrition weigh each term individually (returning no mass if any term cannot be weighed), `gram diff` shows formatted quantities via `fromText`/`toText`, `@gram-lang/renderer` exports `formatUsageQuantity`, and `@gram-lang/i18n` exports `termsTotal`, `mergeTerms`, `formatTerms`, and `Term`.
- 8d1b62e: **Parser & Kitchen**: Timers and section anchors now support natural duration syntax in English and French, with or without spaces:
  - Accepts compound durations (`~{1h30}`, `~{1 hr 30 mins}`, `~{1 heure 30}`, `~{1h + 30min}`, `~{2min30}`), clock notation (`~{1:30 h}`, `~{0:04:30}`), primes (`~{5'30"}`, `~{10'}`), ranges (`~{1h30-2h}`, `~{45 min - 1 h}`), section anchors (`~{-1h30}`, `~{-1j 12h}`), and aliases like `hr`, `hrs`, and `mn`. `gram import` now outputs these natural forms and avoids ambiguous notations like `~{1:30}`.
  - Ambiguous or invalid durations (`~{1:30}`, `~{1h75}`, reversed ranges) raise `INVALID_DURATION` with a suggested fix and are excluded from total time; anchor warnings now point directly to the anchor.
  - Compiled timers store the source text in `raw` and total minutes in `minutes` (normalizing `quantity`/`unit` to the smallest written unit for new forms) and are scheduled like any other timer.
  - Exposes `parseDuration` (`@gram-lang/i18n`) and `readAnchor` (`@gram-lang/kitchen`), and adds `loc` to AST section anchors.
- d5fe9c3: **Parser, Kitchen & Analyzer**: Ingredients, intermediates, and timers can now be written as unit ratios:
  - Supports ratios across units or counts on ingredients (`@eggs{1 / 100 g @&flour}`, `@salt{15 g / 1 L @&water}`), homemade preparations (`&stock{250 ml / 100 g @&rice}`, plus percentages like `&stock{250% @&rice}`), and proportional timers (`~{15 min / 500 g @&roast}`, `~{4 min / @&cutlet}`).
  - Resolves compatible units at compile time and cross-family ratios via the ingredient database; incompatible or zero-denominator ratios raise `RELATIVE_QUANTITY_UNKNOWN_MASS` (with `reason`) or `INVALID_QUANTITY` (`reason: "zeroRatioDenominator"`) instead of guessing.
  - Whole-use references to a section preparation (`Roll out the &dough`) now estimate mass from the producing section, while step-produced intermediates (`Mix … ->&dough`) require an explicit amount (`reason: "stepProducer"`); warnings and formulas in imported bases display original author names rather than internal aliases.
  - Scaling a recipe re-resolves all ratios and recomputes the schedule, total times, and shopping list.
  - Views display resolved ratios in tooltips, and the language server provides syntax highlighting, target completion, intermediate renaming, hover previews, and inlay hints.

### Patch Changes

- Updated dependencies [aa78c53]
- Updated dependencies [073d4f1]
- Updated dependencies [e0f8fbf]
- Updated dependencies [8d1b62e]
- Updated dependencies [7d15360]
- Updated dependencies [f4c6943]
- Updated dependencies [a9e6231]
- Updated dependencies [92bec33]
- Updated dependencies [f91ec4e]
- Updated dependencies [238e012]
- Updated dependencies [4d4b12e]
- Updated dependencies [55188fc]
- Updated dependencies [d5fe9c3]
- Updated dependencies [4d5f79f]
  - @gram-lang/analyzer@1.5.0
  - @gram-lang/parser@1.5.0
  - @gram-lang/kitchen@1.5.0

## 1.4.2

### Patch Changes

- Updated dependencies [6620c24]
- Updated dependencies [3ecc785]
  - @gram-lang/parser@1.4.2
  - @gram-lang/kitchen@1.4.2
  - @gram-lang/analyzer@1.4.2

## 1.4.1

### Patch Changes

- Updated dependencies [d946b46]
- Updated dependencies [4608f96]
- Updated dependencies [efbb381]
  - @gram-lang/analyzer@1.4.1
  - @gram-lang/parser@1.4.1
  - @gram-lang/kitchen@1.4.1

## 1.4.0

### Patch Changes

- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
- Updated dependencies
  - @gram-lang/kitchen@1.4.0
  - @gram-lang/analyzer@1.4.0
  - @gram-lang/i18n@1.4.0
  - @gram-lang/parser@1.4.0

## 1.3.0

### Patch Changes

- a5891a9: **Modules**: Fixed a misleading error message: a syntax error in the recipe you are editing was reported as coming from an "imported module", even when the recipe imports nothing. It now shows the plain syntax error, and the "imported module" wording is kept only for errors that really are in an imported file.
- 95698cc: **Modules & Rendering**: Intermediates declared inside imported modules now show the name you wrote (for example `pressed`) instead of an internal path like `tofu$marinated$pressed`, in `gram view`, HTML and Markdown output.
- Updated dependencies [48c856d]
- Updated dependencies [95698cc]
- Updated dependencies [fac320b]
  - @gram-lang/analyzer@1.3.0
  - @gram-lang/parser@1.3.0
  - @gram-lang/kitchen@1.3.0
  - @gram-lang/i18n@1.3.0

## 1.2.1

### Patch Changes

- Updated dependencies [c8c4d49]
  - @gram-lang/i18n@1.2.1
  - @gram-lang/analyzer@1.2.1
  - @gram-lang/kitchen@1.2.1
  - @gram-lang/parser@1.2.1

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

### Patch Changes

- f617b4c: **Parser & Kitchen**: Improved clarity and tone for diagnostic messages and revised severity tiers:
  - Reworded compiler and module diagnostic messages to provide actionable guidance and avoid alarmist phrasing for standard culinary approximations.
  - Reclassified non-critical notices (`MISSING_MACROS`, `UNKNOWN_MASS`, `TRACK_CONTENTION`) to `info` severity so they do not clutter warning counters.
  - Enhanced Playground and editor diagnostic styling with dedicated color schemes for errors (red), warnings (amber), and notices (blue).
- Updated dependencies [9331a4b]
- Updated dependencies [c31a583]
- Updated dependencies [f617b4c]
- Updated dependencies [2bab3cd]
- Updated dependencies [8a4056b]
- Updated dependencies [aaf8cee]
  - @gram-lang/kitchen@1.2.0
  - @gram-lang/i18n@1.2.0
  - @gram-lang/parser@1.2.0
  - @gram-lang/analyzer@1.2.0
