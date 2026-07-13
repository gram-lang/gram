---
"@gram-lang/parser": major
"@gram-lang/cli": minor
"@gram-lang/language-server": minor
"@gram-lang/docs": minor
---

feat!: replace the `°` temperature sigil with `^`, the `~&` passive timer marker with `~_`, and add mixed/Unicode fraction support

**Breaking syntax changes:**
- The Temperature sigil is now `^` (e.g. `^{180C}`). `°` is no longer a block-opening character, but remains valid inside unit spellings (`°C`).
- The Timer passive marker is now `~_` (e.g. `~_{45min}`) instead of `~&`.
- Temperature units now accept bare `C`/`F` in addition to `°C`/`°F`.

**New syntax:**
- Added support for mixed-number fractions (`1 1/2`) and Unicode vulgar fraction glyphs (`½`).
