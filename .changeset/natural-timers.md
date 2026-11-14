---
"@gram-lang/parser": minor
"@gram-lang/kitchen": minor
"@gram-lang/i18n": minor
---

**Parser & Kitchen**: Timers and section anchors can be written the way recipes write durations, in English or French, with or without spaces:
  - Hours and minutes together: `~{1h30}`, `~{1 hr 30 mins}`, `~{1 heure 30}`, `~{1h + 30min}`, `~{2min30}`; a clock with a unit (`~{1:30 h}`, `~{4:30 min}`) or in full (`~{0:04:30}`); primes (`~{5'30"}`, `~{10'}`); ranges such as `~{1h30-2h}` or `~{45 min - 1 h}`. Anchors read them too (`~{-1h30}`, `~{-1j 12h}`). More unit spellings are recognized, such as `hr`, `hrs` and `mn`.
  - Gram never guesses: a duration it cannot read for sure, such as `~{1:30}` (hours or minutes?), `~{1h75}` or a range written backwards (`~{2-1 h}`), raises the new `INVALID_DURATION` warning with an example to write instead, and is not counted in the total time. An unknown unit still raises `INVALID_UNIT`, and a number alone `MISSING_UNIT`.
  - These durations used to be a syntax error or count for zero minutes: they are now planned like any other timer.
  - In the compiled JSON, every timer keeps what was written in a new `raw` field and its duration in a new `minutes` field. A timer written as before keeps its `quantity` and `unit`; a new form gives them in the smallest unit written (`1h20` is `80 min`).
  - For integrators, `parseDuration` (`@gram-lang/i18n`) reads such a duration into minutes, or says why it will not.
