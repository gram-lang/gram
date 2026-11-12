# @gram-lang/scheduler

## 1.4.0

### Minor Changes

- c653893: **Run sheet**: Fixed the run sheet in "All at the start" and "Per day" modes, so each visit and each day now shows what is really done:
  - A visit is named after the sections cooked in it, no longer after a section whose equipment is only taken out there (for example "Baking" no longer appears on the day the batter is made)
  - Without a serving time, a visit after a long rest now falls on its own day (for example D-1 for the batter and Day D for the baking), as it does with a serving time
  - Scheduler: each visit now also lists the sections it cooks (`worked`), and `visitSections()` gives the sections to name a visit after
- c156d56: **Scheduler**: The planning engine now lives in its own package, `@gram-lang/scheduler`, which `@gram-lang/kitchen` uses:

  - `layout(tasks, { miseEnPlace, rests })` lays a recipe's list of tasks out on a timeline, for any mise en place plan and any choice of waits, and reports what cannot work (a time paradox, a track contention, a working day pushed before its 24 hours)
  - The choices (`MISE_EN_PLACE_MODES`, `REST_CHOICES`, their defaults and guards) and the task types (`TaskGraph`, `Task`, `TaskDuration`) are exported too
  - Compiled recipes keep every field published in 1.3.0 unchanged, and everything `@gram-lang/kitchen` exported before is still exported from it
  - `project(recipes, context)` places a recipe on the calendar: it takes a serving time, a time zone and when the cook is available, and returns each task with its date and time (UTC and local), stretching or shortening the waits written as a range so the cook's own work avoids the night, and reporting what it could not fix
  - `runSheet(plan)` groups a plan, or a bare schedule, into the days of the recipe (and says which mise en place mode it was made in), the visits to the kitchen (a wait of an hour or more ends one) and the waits that go on without the cook; with the graph and the context, it also says how early each visit could be done, and which exact wait holds it in place; each visit also says when each of its sections starts (`sectionStarts`)
  - `findServeTimes()` tries each day of a range at your meal times and ranks the serving times that work, with the reasons of the others; `earliestServe()` gives the first one that works if the cook starts now
  - `parseAvailability(entries)` reads when the cook is available from entries like `08:00-22:00`, `fri=18:00-22:00` or `2026-10-09=none` (the syntax of `gram plan --available` and of the `availability` setting), and says which part is wrong when it cannot
  - `isTimeZone()`, `parseMealTimes()` and `availabilityEntries()` check a time zone, meal times written "HH:MM" and the entries of an `availability` setting, so the CLI and the editor read a project's settings the same way
  - `isCalendarDate("2026-02-30")` tells a real day from a string that only looks like one; the scheduler refuses a date that does not exist (a 30th of February, a 31st of April) everywhere it reads one, instead of moving it to the next month

### Patch Changes

- c653893: **Scheduler**: A recipe planned on the calendar in "All at the start" mode no longer reports a false "wrong day" warning for its single long working day.
