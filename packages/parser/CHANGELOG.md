# @gram/parser

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
