---
"@gram-lang/parser": minor
"@gram-lang/kitchen": minor
"@gram-lang/i18n": minor
"@gram-lang/modules": minor
"@gram-lang/cli": minor
---

**Parser & Kitchen**: Timers and section anchors now support natural duration syntax in English and French, with or without spaces:
  - Accepts compound durations (`~{1h30}`, `~{1 hr 30 mins}`, `~{1 heure 30}`, `~{1h + 30min}`, `~{2min30}`), clock notation (`~{1:30 h}`, `~{0:04:30}`), primes (`~{5'30"}`, `~{10'}`), ranges (`~{1h30-2h}`, `~{45 min - 1 h}`), section anchors (`~{-1h30}`, `~{-1j 12h}`), and aliases like `hr`, `hrs`, and `mn`. `gram import` now outputs these natural forms and avoids ambiguous notations like `~{1:30}`.
  - Ambiguous or invalid durations (`~{1:30}`, `~{1h75}`, reversed ranges) raise `INVALID_DURATION` with a suggested fix and are excluded from total time; anchor warnings now point directly to the anchor.
  - Compiled timers store the source text in `raw` and total minutes in `minutes` (normalizing `quantity`/`unit` to the smallest written unit for new forms) and are scheduled like any other timer.
  - Exposes `parseDuration` (`@gram-lang/i18n`) and `readAnchor` (`@gram-lang/kitchen`), and adds `loc` to AST section anchors.
