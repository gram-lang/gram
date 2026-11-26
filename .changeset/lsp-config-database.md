---
"@gram-lang/language-server": patch
"gram-lang": patch
---

**Language Server**: The editor now reads the ingredient database named by `database:` in the project's `.gram/config.yaml`, as `gram` does, instead of ignoring it and showing no unknown ingredient, nutrition hover or gram conversion. It falls back to `.gram/ingredients.yaml` when `database:` is not set, and `gram.ingredientDatabase.path` still takes precedence over both. Editing that file, or changing `database:`, refreshes the diagnostics without a restart.
