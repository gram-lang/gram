---
"@gram-lang/scheduler": minor
"@gram-lang/renderer": minor
"@gram-lang/cli": minor
"@gram-lang/language-server": minor
"gram-lang": minor
"@gram-lang/docs": minor
---

**Scheduler, Renderer & CLI**: Clock times can now be entered and displayed in 12-hour (`1:00 PM`) as well as 24-hour (`13:00`) format:
  - `--available`, `--meal-times`, `--serve`, `--find`, their `availability` and `mealTimes` settings, and the editor's serving time accept 12-hour times in any case or spacing (`8am-10pm`, `fri=6pm-12am`, `12:30pm,8pm`, `"2026-10-11 1:00 pm"`), rejecting invalid forms like `13pm`, `0am`, or bare hours.
  - Adds a `clock` view setting (`auto`, `12h`, `24h`) controlling time formatting in the run sheet, serving-time suggestions, and iCalendar descriptions; `auto` (default) follows the reader's locale region rather than the recipe language.
  - Configurable via `--clock` (`gram plan`, `gram export`, `gram print`), `clock` in `.gram/config.yaml` (or global config), `gram.clock` in VS Code, and the playground's Display menu.
  - Adds `locale` support to `prepareViews()`, an `hourCycle` option to run sheets, clock helpers (`formatClock`, `chooseClock`, `resolveHourCycle`, `systemLocale`) in `@gram-lang/renderer`, and `parseTimeOfDay` / `parseLocalDateTime` in `@gram-lang/scheduler` (JSON and ISO data remain unchanged).
