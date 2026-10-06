---
"@gram-lang/scheduler": minor
"@gram-lang/kitchen": minor
---

**Scheduler**: The planning engine now lives in its own package, `@gram-lang/scheduler`, which `@gram-lang/kitchen` uses:

- `layout(tasks, { miseEnPlace, rests })` lays a recipe's list of tasks out on a timeline, for any mise en place plan and any choice of waits, and reports what cannot work (a time paradox, a track contention, a working day pushed before its 24 hours)
- The choices (`MISE_EN_PLACE_MODES`, `REST_CHOICES`, their defaults and guards) and the task types (`TaskGraph`, `Task`, `TaskDuration`) are exported too
- Compiled recipes keep every field published in 1.3.0 unchanged, and everything `@gram-lang/kitchen` exported before is still exported from it
- `project(recipes, context)` places a recipe on the calendar: it takes a serving time, a time zone and when the cook is available, and returns each task with its date and time (UTC and local), stretching or shortening the waits written as a range so the cook's own work avoids the night, and reporting what it could not fix
- `runSheet(plan)` turns that plan into the structure of a production sheet: the days, and the tasks of each day in order
