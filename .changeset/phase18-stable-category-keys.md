---
"@gram-lang/i18n": minor
---

Food categories now have stable, language-independent keys (`CATEGORY_KEYS`, `CategoryKey`, `getCategoryLabels`, `isCategoryKey`) instead of only translated display labels. This means `gram db enrich` now stores a category identity that stays consistent regardless of your configured language, rather than a French or English label baked in at write time.
