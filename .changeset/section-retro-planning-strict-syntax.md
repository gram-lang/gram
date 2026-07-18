---
"@gram-lang/parser": major
"@gram-lang/kitchen": major
"@gram-lang/renderer": major
"@gram-lang/i18n": minor
"@gram-lang/docs": minor
---

Section retro-planning (`## Section ~{-2h}`) now requires strict signed-duration syntax instead of accepting arbitrary free text

**Breaking:**
- `SectionAST.retroPlanning` (`@gram-lang/parser`) changed from `string | null` to a structured `RetroPlanningAST | null`: `{ raw, sign, value, unit }`. The grammar rule itself is unchanged — it still accepts any `~{...}` text, deliberately: tightening it was tried and reverted after confirming empirically that Ohm's `absoluteQuantity` still swallows free text like `la veille` as a bogus unit, and that inputs which *do* fail to match make the whole section silently vanish into the previous one's body instead of raising a clean error (see the comment above the `describe("section retro-planning", ...)` block in `packages/parser/tests/grammar-edge-cases.test.ts`). The parser now just mechanically extracts sign/value/unit from the captured text instead of returning it verbatim.
- `ProcessedSection.retro_planning` (`@gram-lang/kitchen`) changed from `string | null` to a structured object: `{ raw, sign?, value?, unit?, minutes? }`. `sign`/`value`/`unit`/`minutes` are only present once the annotation resolves to a valid duration; free text or an unrecognized unit degrades to `{ raw }` only, so the original annotation still displays.
- `@gram-lang/renderer`'s HTML/Markdown/print formatters now read `sec.retro_planning.raw` instead of the old bare string — a `CompilationResult` produced by an older `@gram-lang/kitchen` will render `undefined` in the retro-planning badge instead of the original text.

**Fixed:**
- Free text like `~{the day before}` (or `~{la veille}`), an unsigned/positive value (`~{2h}`), and a zero value (`~{0h}`/`~{-0h}`) are no longer silently treated as valid retro-planning: retro-planning only makes sense as anticipation ("prepare N time before the rest"), so the compiler now requires a strictly negative signed duration and flags anything else with `MISSING_UNIT`/`INVALID_UNIT` — the exact same warning codes and `"warning"` severity `~timer` already uses (non-blocking by default, promoted to an error by `gram check --strict`), rather than a separate validation path.
- `@gram-lang/i18n`'s time dictionary gains a `d` (day) canonical unit — `day`/`days` in English, `j`/`jour`/`jours` in French — resolved through the same global, language-agnostic lookup `~timer` uses. `~{-2d}` (the example used throughout the docs) is now actually convertible to minutes, and `~{-2j}` resolves identically in a French recipe.

Documentation (`times.md`, `document-structure.md`, `parser.md`, `data-formats.md`, `philosophy.md` — English and French) is updated to match, including two API reference examples that previously showed the now-invalid free-text form as if it were the intended usage.
