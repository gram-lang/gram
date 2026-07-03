---
"@gram/analyzer": minor
"@gram/cli": minor
---

Migrated Baker's Percentage math computation from the CLI directly into the core Analyzer engine. 

- **@gram/analyzer**: The enriched JSON AST now natively includes a `bakersPercentage` field for all ingredients if a reference ingredient is declared (using `@*` in the recipe) or passed via the `bakersReference` option. Also includes a critical null-safety fix when parsing recipes containing standalone comments.
- **@gram/cli**: The CLI now cleanly acts as a presentation layer for Baker's Math, reading percentages directly from the AST. Added `--bakers-math`, `--bakers-reference`, and `--bakers-math-only` flags to the `view` command.
