---
"@gram-lang/parser": patch
"@gram-lang/docs": patch
---

fix: sync TextMate grammar with the `^`/`~_` sigil changes and stop mis-highlighting invalid temperature units

- Updated TextMate grammar to use `^` (Temperature) and `~_` (Passive Timer) sigils.
- Temperature unit highlighting now mirrors the compiler's whitelist (e.g., `180C`/`180°F`). Invalid units now receive a distinct `invalid.illegal.unit.gram` scope.
- Name matching now correctly stops at the new `^` sigil.
