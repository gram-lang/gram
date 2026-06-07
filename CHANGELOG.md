# Changelog

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