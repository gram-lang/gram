---
"@gram-lang/kitchen": minor
"@gram-lang/parser": minor
"@gram-lang/language-server": minor
---

**Parser & Kitchen**: Three common writing mistakes, often made by AI models that know Cooklang better than Gram, are now reported with the fix to make:
  - `&flour` on an ingredient written earlier as `@flour{…}` raises a new `REFERENCE_TO_INGREDIENT` warning: `&` names an intermediate, `@&flour` mentions the ingredient again. An intermediate sharing the name (`->&chicken`) or a `@use … as &name` binding raises nothing.
  - Cooklang's `%` between a number and its unit is flagged with the corrected form: `~{15%min}` keeps its `INVALID_DURATION` warning and now suggests `~{15 min}`, and `@flour{200%g}`, read until now as an unknown unit `%g` with no mass and no warning, raises `INVALID_UNIT` and suggests `{200 g}`.
  - The parse error of a temperature in cookware braces (`#oven{180°C}`) now says to write `^oven{180°C}`.
  - In the editor, each warning comes with a one-click quick fix. The compiled recipe only changes in its `warnings`; with `gram check --strict`, a recipe holding one of these mistakes now fails.
