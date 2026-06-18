# @gram/kitchen

## 0.10.1

### Patch Changes

- Cleaned up and updated dependencies.
- Implemented Turborepo to optimize and simplify project building.
- Updated dependencies
  - @gram/parser@0.10.1
  - @gram/i18n@0.10.1

## 0.10.0

### Minor Changes

- cfda9e1: Refactored unit translation and normalization into a new centralized @gram/i18n package to remove redundancy between the compiler and analyzer.

### Patch Changes

- 705bb45: Migrated to full Bun environment using 'workspace:\*' dependencies
- 3720644: Added Zod to automatically catch invalid data and prevent crashes.
- 63ec5a4: Improved code safety in the compiler by adding strict type checking for recipe elements.
- cdf3181: Introduce a unified `getNumericQty` utility in `utils.ts` to safely extract numeric values from AST Quantity structures (including fractions, ranges, and nested nodes). This fixes a bug where composite child ingredient quantities using fractions (e.g. `@zest{1/2}`) aggregated to zero in the shopping list.
- 05791fd: Cleaned up repetitive code that manages and saves ingredients and cookware.
- 833cfbf: Standardized the warning system to provide consistent and reliable error messages across all tools.
- 919f299: Refactored AST processing for improved maintainability.
- 69870cc: Standardized how recipe elements are identified across the system to prevent typos and errors.
- Updated dependencies [3720644]
- Updated dependencies [63ec5a4]
- Updated dependencies [cfda9e1]
- Updated dependencies [087b78b]
- Updated dependencies [69870cc]
  - @gram/i18n@0.10.0
  - @gram/parser@0.10.0

## 0.9.0

### Minor Changes

- 2963b48: Ingredients states (`@ingredient:state{}`) are removed. While the idea was to better organize the ingredient's database, it just happened to be too confusing to use.
- 2963b48: Ingredient references without quantities (`@&ingredient{}`) are now excluded from section ingredients summaries. This keeps section-level mise en place lists clean by filtering out pure flow instructions (like removing or re-inserting) while preserving separate measured portions.
- 2963b48: Extracted analyzer logic (mass normalization, yield management, nutritional estimation) into its own package. Ingredients database must now be provided by the user.
- 2550f2a: GRAM syntax now also accepts semantic temperatures (e.g: Cook on !{low heat})

### Patch Changes

- 2550f2a: Cleaned repo with removal of /dist folders
- 7f4fa0d: Using changesets to simplify changelog management
- 664ea91: Clarification of global comments for a recipe, to be declared in the front matter as "notes"
