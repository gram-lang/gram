# @gram/analyzer

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
