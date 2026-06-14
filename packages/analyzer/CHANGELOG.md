# @gram/analyzer

## 0.10.0

### Minor Changes

- dc98e0b: Added Bun snapshot testing to the development environment for compiler validation.
- cfda9e1: Refactored unit translation and normalization into a new centralized @gram/i18n package to remove redundancy between the compiler and analyzer.

### Patch Changes

- c720fa1: Refactored the analyzer to reuse the compiler's getNumericQty utility, improving code DRYness and type safety.
- 705bb45: Migrated to full Bun environment using 'workspace:\*' dependencies
- 3720644: Added Zod to automatically catch invalid data and prevent crashes.
- 833cfbf: Standardized the warning system to provide consistent and reliable error messages across all tools.
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
  - @gram/compiler@0.10.0
  - @gram/i18n@0.10.0
  - @gram/parser@0.10.0

## 0.9.0

### Minor Changes

- 2963b48: Ingredients states (`@ingredient:state{}`) are removed. While the idea was to better organize the ingredient's database, it just happened to be too confusing to use.
- 2963b48: Updated unit resolution to allow for french aliases (e.g: tsp = càc)
- 2963b48: Fixed multiple issues with mass calculations
- 2963b48: Extracted analyzer logic (mass normalization, yield management, nutritional estimation) into its own package. Ingredients database must now be provided by the user.

### Patch Changes

- 2550f2a: Cleaned repo with removal of /dist folders
- 7f4fa0d: Using changesets to simplify changelog management
- 664ea91: Clarification of global comments for a recipe, to be declared in the front matter as "notes"
- 2963b48: Empty ingredient masses now count as zero.
