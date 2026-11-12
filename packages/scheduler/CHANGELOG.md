# @gram-lang/scheduler

## 1.4.0

### Minor Changes

- **Scheduler**: The planning engine now lives in its own package, `@gram-lang/scheduler`, which `@gram-lang/kitchen` uses. Compiled recipes keep every field published in 1.3.0, and everything `@gram-lang/kitchen` exported before is still exported from it:

  - `layout(tasks, { miseEnPlace, rests })` lays a recipe's list of tasks out on a timeline, for any mise en place plan and any choice of waits, and reports what cannot work (a time paradox, a track contention, a working day pushed before its 24 hours)
  - `project(recipes, context)` places a recipe on the calendar from a serving time, a time zone and when the cook is available; it stretches or shortens the waits written as a range so the cook's own work avoids the night, and reports what it could not fix
  - `runSheet(plan)` groups a plan into the days of the recipe, the visits to the kitchen (with the sections each one cooks and how early it could be done) and the waits that go on without the cook
  - `findServeTimes()` ranks the serving times that work over a range of days, with the reasons of the others, and `earliestServe()` gives the first one that works if the cook starts now
  - `parseAvailability()`, `parseMealTimes()` and the other readers of a project's settings (`08:00-22:00`, `fri=18:00-22:00`, `2026-10-09=none`) are shared by the CLI and the editor
