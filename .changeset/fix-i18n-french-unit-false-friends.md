---
"@gram-lang/i18n": patch
"@gram-lang/analyzer": patch
---

Fixed several French unit words silently resolving to the wrong physical quantity:

- `quart`/`quarts` no longer resolves to the US liquid quart (946 mL) in French recipes — it's a false friend ("un quart d'heure" means "a quarter of an hour", not a unit of volume). It's now reported as an unknown unit instead of silently misinterpreted. The English word `quart`/`quarts` still works in English recipes; only the spelled-out alias was removed, `qt` still works everywhere.
- `livre` now converts using the French "livre métrique" (500 g) instead of being silently treated as the imperial pound (453.592 g) — a ~10% error.
- `tasse` now converts using the French cup (250 mL) instead of being silently treated as the US cup (236.588 mL) — a ~6% error.
- `pinte` no longer resolves at all: the historical French pinte has no single reliable modern value, so an explicit "unknown unit" is better than a confident-looking wrong number.
- `gallon`/`gallons` now resolve correctly (previously only the abbreviation `gal` worked).
