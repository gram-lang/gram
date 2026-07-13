# @gram-lang/docs

## 1.0.0-beta.2

### Minor Changes

- 6e09879: fix!: `gram check` only fails on structural errors by default (use `--strict` for the old behavior), fix LSP completion race, and add ingredients.yaml live reload

  **Breaking:**

  - `gram check` now only fails on structural issues (like undefined references) and uses a shared `warningSeverity` map. Nutritional gaps and incomplete annotations are reported as warnings instead of failing the build. Use `--strict` for the old all-warnings-fail behavior.
  - `GramConfigError` exit code changed from 2 to 1 (user error, not internal crash).

  **Fixed:**

  - Language Server: Fixed a race condition where completions immediately after `@` or `&` could return nothing.
  - Language Server: Diagnostics now correctly use the shared `warningSeverity` map.
  - Language Server: `ingredients.yaml` is now actively watched via LSP. External edits instantly refresh diagnostics without restarting the editor.

- 6d9011f: Added a bilingual (EN/FR) "API Reference" section covering the programmatic API of `@gram-lang/parser`, `@gram-lang/kitchen`, `@gram-lang/analyzer`, `@gram-lang/renderer`, and `@gram-lang/i18n` — function signatures, options, JSON data formats, and the full warning-code catalogue. Reference tables (warning codes, AST node types, unit conversions, categories) are generated at build time directly from each package's source, so they can't drift out of sync with the code. Also fixed an incorrect `analyze()` call example in `how-to/build-custom-ui.md`.
- 14b7b2b: The playground now shows a red squiggly marker at the exact location of a syntax error using the new `offset` field.

  Fixed a crash in the playground on mount in real browsers caused by an aggressive automated lint fix that removed necessary Vue `<template>` bindings and component imports.

- 8dc9c60: feat!: validate and normalize temperature units, add a shared warning severity map, and fix accented/non-Latin ingredient slugs

  **Kitchen:**

  - `warningSeverity`: a new exported map to separate structural errors from recoverable warnings.
  - Temperature units are now validated and normalized to canonical `°C`/`°F`.
  - `slugify` now preserves non-Latin letters via `\p{L}`/`\p{N}`.

  **Analyzer:**

  - Fixed `parseDensityOverrides` name normalization for accented ingredient names.

- 6eab9b3: feat!: replace the `°` temperature sigil with `^`, the `~&` passive timer marker with `~_`, and add mixed/Unicode fraction support

  **Breaking syntax changes:**

  - The Temperature sigil is now `^` (e.g. `^{180C}`). `°` is no longer a block-opening character, but remains valid inside unit spellings (`°C`).
  - The Timer passive marker is now `~_` (e.g. `~_{45min}`) instead of `~&`.
  - Temperature units now accept bare `C`/`F` in addition to `°C`/`°F`.

  **New syntax:**

  - Added support for mixed-number fractions (`1 1/2`) and Unicode vulgar fraction glyphs (`½`).

- a46c24f: Upgraded all monorepo dependencies to their latest versions and implemented a TypeScript 7 dual setup for faster typechecking while preserving compilation toolchain compatibility. Fixed type errors arising from Node 26 and VS Code LSP v10 updates.

### Patch Changes

- e55940f: fix: sync TextMate grammar with the `^`/`~_` sigil changes and stop mis-highlighting invalid temperature units

  - Updated TextMate grammar to use `^` (Temperature) and `~_` (Passive Timer) sigils.
  - Temperature unit highlighting now mirrors the compiler's whitelist (e.g., `180C`/`180°F`). Invalid units now receive a distinct `invalid.illegal.unit.gram` scope.
  - Name matching now correctly stops at the new `^` sigil.

## 1.0.0-beta.1

### Minor Changes

- b48a053: docs: update timer terminology from synchronous/asynchronous to active/passive

  To better align with real-world culinary concepts and eliminate confusion, the terminology for timers has been updated throughout the documentation.

  Previously, Gram used computer-science terms (`synchronous` / `asynchronous`) to describe how timers affected the recipe flow. However, in a kitchen environment, almost all timers block the preparation itself, even if they run in the background.

  To clarify this, we have shifted the terminology to focus on the cook's availability rather than the execution thread:

  - **Synchronous** timers are now referred to as **Active** timers. These timers require the cook's attention and add to the `activeTime` metric.
  - **Asynchronous** (`~&`) timers are now referred to as **Passive** (or Idle) timers. These timers represent background tasks (like resting or baking) that free up the cook to perform other steps concurrently.

  **Note:** This is a purely conceptual nomenclature change to make the documentation and learning curve more intuitive for non-developers. The underlying syntax (`~{}` and `~&{}`) and the compiler's Gantt chart logic remain exactly the same.

- a244341: Major overhaul of the documentation and playground infrastructure:

  - **Documentation Rewrite & i18n**: The documentation has been completely rewritten, thoroughly verified, and is now fully translated into French (in addition to the English version).
  - **Advanced Vue 3 Playground**: The legacy playground has been removed and rebuilt from the ground up using Vue 3. This new version is directly integrated into the documentation and introduces powerful new features, including recipe scaling and baker's math.

- 4e27dd8: docs: integrate new Vitepress documentation site and embedded playground

  - **Documentation**: Complete overhaul of the Gram documentation site using Vitepress. Improved layout, better navigation, and comprehensive coverage of the new syntax and APIs.
  - **Playground**: Replaced the legacy standalone playground with a new, fully integrated version directly within the Vitepress documentation site. Features live-reloading, side-by-side editing, and syntax highlighting via Shiki.

- 9ff4563: - **Playground**: Migrated syntax highlighting engine from Highlight.js to Shiki. The playground now natively uses the official VSCode TextMate grammar, ensuring 100% consistency across environments.
  - **VSCode Extension**: Improved syntax coloring by mapping custom Gram tokens (cookware, intermediate ingredients, units) to standard semantic TextMate scopes, restoring vibrant and legible colors across all VSCode themes.

### Patch Changes

- 02d63ff: **Breaking Change: Refactored Physical Engine Nomenclature**

  The physical enrichment options and internal APIs have been renamed for clarity and to align with professional culinary terminology.

  If you are using `@gram-lang/analyzer` programmatically, please update your configuration:

  - `enableMassNormalization` is now **`enableMassStandardization`**
  - `enableYieldManagement` is now **`enableYieldCalculation`**
  - The exported `normalizeMass` helper is now **`standardizeMass`**

  This update ensures total parity with the updated official documentation.

- 6013e64: Refactor TextMate grammar to `@gram-lang/parser`

  The TextMate grammar (`gram.tmLanguage.json`) has been moved from `@gram-lang/vscode-extension` to `@gram-lang/parser` to colocate the structural (Ohm) and lexical (TextMate) definitions of the Gram language.

  This resolves architectural issues where consumers like the playground had to perform brittle, deep relative imports into the VSCode extension package. The syntax grammar is now officially exported and accessible via `@gram-lang/parser/textmate`.
