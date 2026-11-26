---
"@gram-lang/language-server": patch
---

**Language Server**: An ingredient is now reported as unknown exactly when the nutrition estimate cannot find it in the ingredient database, and its nutrition hover shows up exactly when it can:
  - Names that differ from a database entry only by case, accents, hyphens or apostrophes are no longer flagged (`@olive-oil` or `@Huile d’olive` with a curly apostrophe, a hyphenated alias, a database key not written in lowercase).
  - Plurals are no longer guessed: `@carrots` with only `carrot` in the database is now flagged, with `carrot` suggested, because the nutrition estimate never counted it. The guess also matched different ingredients (`@pâtes`, pasta, passed as `pâte`, pastry). Write the singular, or add the plural to the entry's `aliases`.
