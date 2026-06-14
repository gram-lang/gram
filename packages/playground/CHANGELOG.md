# @gram/playground

## 0.10.0

### Minor Changes

- d89c2a4: Created a new shared @gram/renderer package to handle HTML and Markdown generation.

### Patch Changes

- 705bb45: Migrated to full Bun environment using 'workspace:\*' dependencies
- 3720644: Added Zod to automatically catch invalid data and prevent crashes.
- cdf3181: Format decimal values strictly below 1 (e.g. `0.5`, `0.25`) as clean culinary fractions (`1/2`, `1/4`) in the shopping list, while keeping standard decimal formatting for values greater than or equal to 1 (e.g. `1.5`).
- 087b78b: Improved parser stability and removed complex build workarounds for web environments.
- 69870cc: Standardized how recipe elements are identified across the system to prevent typos and errors.
- Updated dependencies [dc98e0b]
- Updated dependencies [d89c2a4]
- Updated dependencies [c720fa1]
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
  - @gram/analyzer@0.10.0
  - @gram/renderer@0.10.0
  - @gram/compiler@0.10.0
  - @gram/parser@0.10.0

## 0.9.0

### Minor Changes

- 2963b48: Ingredients states (`@ingredient:state{}`) are removed. While the idea was to better organize the ingredient's database, it just happened to be too confusing to use.
- 2963b48: Extracted analyzer logic (mass normalization, yield management, nutritional estimation) into its own package. Ingredients database must now be provided by the user.
- 2550f2a: GRAM syntax now also accepts semantic temperatures (e.g: Cook on !{low heat})

### Patch Changes

- 2550f2a: Cleaned repo with removal of /dist folders
- 7f4fa0d: Using changesets to simplify changelog management
- 664ea91: Clarification of global comments for a recipe, to be declared in the front matter as "notes"
- 2550f2a: Removed unwanted spaces from default playground input
