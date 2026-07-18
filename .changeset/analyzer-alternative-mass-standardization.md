---
"@gram-lang/analyzer": patch
---

Fix mass standardization silently skipping alternative ingredient groups (`@egg|@tofu`). `analyze()` had a dedicated branch for composite entries but none for alternatives, so no option in an alternative group ever got `normalizedMass`/`isEstimate`/`conversionMethod` — missing from the shopping list, the section ingredient list, and the inline step-text mention alike. This also silently broke the recipe's aggregate mass total: `calculateMassMetrics` already picked `options[0]` as the representative mass for an alternative group, but found nothing to pick, permanently downgrading `massStatus` to `"incomplete"` and adding the literal string `"alternative"` to `missingMassIngredients`.

Each option in an alternative is now standardized independently (never summed into a single group total — only one option is ever actually bought, unlike a composite's children).
