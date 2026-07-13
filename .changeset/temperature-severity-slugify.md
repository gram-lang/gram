---
"@gram-lang/kitchen": major
"@gram-lang/analyzer": patch
"@gram-lang/docs": minor
---

feat!: validate and normalize temperature units, add a shared warning severity map, and fix accented/non-Latin ingredient slugs

**Kitchen:**
- `warningSeverity`: a new exported map to separate structural errors from recoverable warnings.
- Temperature units are now validated and normalized to canonical `°C`/`°F`.
- `slugify` now preserves non-Latin letters via `\p{L}`/`\p{N}`.

**Analyzer:**
- Fixed `parseDensityOverrides` name normalization for accented ingredient names.
