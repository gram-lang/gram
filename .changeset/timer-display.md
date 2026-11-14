---
"@gram-lang/renderer": minor
"@gram-lang/cli": minor
"@gram-lang/i18n": minor
---

**Rendering**: Timers in the steps are now shown like every other time on the page, with a non-breaking space between number and unit (`~{90min}` and `~{1h30}` both read `1 h 30 min`, a range reads `45 min – 1 h` or `1–2 h`, also in `gram cook` and in the run sheet's waits), through the new `formatDurationRange` and `formatTimerDuration` helpers; a custom `formatDuration` option now applies to timers too.

**Deprecated**
  - i18n: the `runSheetRange` string of the renderer dictionary (`"{min} to {max}"`), no longer used by the run sheet, removed in 2.0.0. Write a range with `formatDurationRange()` from `@gram-lang/renderer` instead.
