# Changelog

## [0.10.1] - 6/14/2026

### 🐛 Bug Fixes & Improvements

- Cleaned up and updated dependencies.
- Implemented Turborepo to optimize and simplify project building.

## [0.10.0] - 6/14/2026

### ✨ New Features
- Added Bun snapshot testing to the development environment for compiler validation.
- Created a new shared @gram/renderer package to handle HTML and Markdown generation.
- Refactored unit translation and normalization into a new centralized @gram/i18n package to remove redundancy between the compiler and analyzer.

### 🐛 Bug Fixes & Improvements
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

### ✨ New Features
- Ingredients states (`@ingredient:state{}`) are removed. While the idea was to better organize the ingredient's database, it just happened to be too confusing to use.
- Updated unit resolution to allow for french aliases (e.g: tsp = càc)
- Ingredient references without quantities (`@&ingredient{}`) are now excluded from section ingredients summaries. This keeps section-level mise en place lists clean by filtering out pure flow instructions (like removing or re-inserting) while preserving separate measured portions.
- Fixed multiple issues with mass calculations
- Extracted analyzer logic (mass normalization, yield management, nutritional estimation) into its own package. Ingredients database must now be provided by the user.
- GRAM syntax now also accepts semantic temperatures (e.g: Cook on !{low heat})

### 🐛 Bug Fixes & Improvements
- Cleaned repo with removal of /dist folders
- Using changesets to simplify changelog management
- Clarification of global comments for a recipe, to be declared in the front matter as "notes"
- Removed unwanted spaces from default playground input
- Empty ingredient masses now count as zero.

---
