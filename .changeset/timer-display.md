---
"@gram-lang/renderer": minor
"@gram-lang/cli": minor
"@gram-lang/i18n": minor
---

**Rendering**: Timers in steps now format durations consistently with the rest of the page using non-breaking spaces (`~{90min}` and `~{1h30}` display as `1 h 30 min`, ranges as `45 min – 1 h` or `1–2 h`), across views, `gram cook`, and the run sheet, via the new `formatDurationRange` and `formatTimerDuration` helpers and the `formatDuration` option.

**Deprecated**
  - `@gram-lang/i18n`: `runSheetRange` in the renderer dictionary (`"{min} to {max}"`), no longer used by the run sheet, will be removed in 2.0.0. Use `formatDurationRange()` from `@gram-lang/renderer` instead.
