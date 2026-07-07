---
"@gram-lang/parser": major
"@gram-lang/cli": minor
"@gram-lang/language-server": minor
"@gram-lang/docs": minor
---

feat!: replace the `°` temperature sigil with `^`, the `~&` passive timer marker with `~_`, and add mixed/Unicode fraction support

**Breaking syntax changes:**

- The Temperature sigil is now `^` (e.g. `^{180C}`, `^oven{180C}`). `°` is no longer a recognized element trigger — it remains valid only inside the unit spelling itself (`°C`/`°F`), never as the block-opening character. `°` was the only non-ASCII sigil in the grammar; every other sigil (`@ # ~ &`) is a plain ASCII character, so this removes that inconsistency rather than adding a second valid spelling alongside it.
- The Timer passive marker is now `~_` (e.g. `~_{45min}`) instead of `~&`. The `&` reference modifier is unchanged everywhere else (ingredient/cookware modifier, standalone `Reference`, `relativeQuantity`) — only the Timer's unrelated reuse of `&` for "passive" is removed.
- Temperature units now accept bare `C`/`F` in addition to `°C`/`°F` at the grammar level (validation and normalization to a canonical form land in a follow-up change).

**New syntax:**

- Mixed-number fractions are now supported in any quantity: `@flour{1 1/2 cups}`.
- Unicode vulgar fraction glyphs are now supported and normalized to the same decimal value: `@sugar{½ cup}`, `@sugar{1½ cups}`.

No `.gram` corpus exists yet, so there is no migration path provided — existing recipes using `°` or `~&` must be rewritten.
