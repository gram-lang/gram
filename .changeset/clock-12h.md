---
"@gram-lang/scheduler": minor
"@gram-lang/renderer": minor
"@gram-lang/cli": minor
"@gram-lang/language-server": minor
"gram-lang": minor
"@gram-lang/docs": minor
---

**Scheduler, Renderer & CLI**: Times can be written and shown in 12 hours (1:00 PM) as well as in 24 hours (13:00), following the reader's region:
  - `--available`, `--meal-times`, `--serve`, the bounds of `--find`, their `availability` and `mealTimes` settings and the editor's serving time take 12-hour times, in any case and with or without spaces: `8am-10pm`, `fri=6pm-12am` (until midnight), `12:30pm,8pm`, `"2026-10-11 1:00 pm"`. `13pm`, `0am` or a bare hour (`8`) are refused with a message showing both forms.
  - A new `clock` view setting (`auto`, `12h`, `24h`) says how the run sheet, the serving time suggestions and the iCalendar descriptions write the time of day. With `auto`, the default, it follows the region of the reader's locale, not the language of the recipe.
  - Set it with `--clock` on `gram plan`, `gram export` and `gram print`, with `clock` in `.gram/config.yaml` (or the global config), with `gram.clock` in VS Code, or with the new "Time format" menu of the playground's Display section. The CLI and the language server read the machine's locale (`LC_ALL`, `LC_TIME`, `LANG`), the playground the browser's.
  - The renderer exports `resolveHourCycle`, `hourCycleOf`, `systemLocale`, `chooseClock`, `formatClock` and `clockFormatOptions`, `prepareViews()` takes the reader's `locale`, and the run sheet's options take an `hourCycle`; the scheduler exports `parseTimeOfDay` and `parseLocalDateTime`. The data (JSON, ISO times) is the same whatever the clock.
