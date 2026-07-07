---
"@gram-lang/parser": patch
"@gram-lang/docs": patch
---

fix: sync the TextMate grammar (syntax highlighting) with the `^`/`~_` sigil change and stop mis-highlighting invalid temperature units as valid

- The editor grammar was still keyed on `°` (Temperature) and `~&` (passive Timer) — the old sigils from before this same change series replaced them with `^` and `~_`. Every `.gram` file would have shown as syntax-error-red in the editor despite compiling correctly, or vice versa.
- Temperature unit highlighting now mirrors the compiler's own whitelist: `180C`/`180°F` (case-insensitive) are scoped as a real unit; anything else after a number (e.g. `180K`) gets a distinct `invalid.illegal.unit.gram` scope instead of being colored identically to a valid unit; qualitative text with no leading number (`medium heat`) gets its own `string.unquoted.descriptor.gram` scope instead of sharing the unit's color. Previously all three cases looked the same.
- Ingredient/cookware/reference/composite name matching now stops at `^` (the new Temperature sigil) instead of the retired `°`, so a name immediately followed by a temperature no longer gets swallowed into it.

The `gram-lang` VS Code extension picks this up automatically — it copies this file from `@gram-lang/parser` at build time, not a separate maintained copy.
