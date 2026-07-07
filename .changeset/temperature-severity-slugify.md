---
"@gram-lang/kitchen": major
"@gram-lang/analyzer": patch
"@gram-lang/docs": minor
---

feat!: validate and normalize temperature units, add a shared warning severity map, and fix accented/non-Latin ingredient slugs

**Kitchen:**

- `warningSeverity`: a new exported `Record<WarningCode, 'error' | 'warning' | 'info'>` map, the single source of truth for which compiler warnings are structural errors (`UNDEFINED_REFERENCE`, `CIRCULAR_REFERENCE`, `SCOPE_CONFLICT`) versus recoverable warnings (everything else — nutritional/estimation gaps and incomplete-but-valid annotations). Intended to replace ad-hoc severity logic in the CLI and language server.
- Temperature units are now validated against a Celsius/Fahrenheit whitelist (`C`, `F`, `°C`, `°F`, case-insensitive) and normalized to the canonical `°C`/`°F` spelling in the compiled output, regardless of how they were written in the source. An unrecognized unit (e.g. `^{200K}`) now raises `INVALID_UNIT` instead of being silently accepted.
- `slugify` now preserves non-Latin letters (CJK, Cyrillic, Arabic…) via `\p{L}`/`\p{N}` instead of stripping them to an empty string — previously, two recipes named entirely in a non-Latin script would both collapse to the same `unknown` id. A deterministic short hash is used as a fallback only when a name has no letters/digits at all (e.g. an emoji-only title).

**Analyzer:**

- Fixed `parseDensityOverrides` reimplementing its own (non-accent-folding) name normalization instead of using `slugify` — density overrides for accented ingredient names (e.g. `densities: [crème fraîche:1.02]`) were silently never matched against the ingredient's actual slug.

**Docs:** updated to match — temperature unit acceptance/normalization, and the `build-custom-ui.md` rendering example (which manually prepended `°` and would otherwise double it up now that the unit already carries it).
