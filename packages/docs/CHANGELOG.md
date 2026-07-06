# @gram-lang/docs

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
