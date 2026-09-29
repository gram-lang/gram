---
"@gram-lang/analyzer": patch
"@gram-lang/cli": patch
---

**Analyzer**: Fixed ingredients being ignored for density conversion and nutrition when their entry in `ingredients.yaml` isn't spelled exactly like the recipe name, such as "Huile d'olive" stored under `huile-dolive`:

- Volumes like `@Huile d'olive{10ml}` are now converted to grams and no longer trigger "ingredient missing nutrition data"
- `gram db lint` now reports ingredients whose names or aliases would be confused with each other
