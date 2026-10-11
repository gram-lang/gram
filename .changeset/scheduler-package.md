---
"@gram-lang/scheduler": minor
"@gram-lang/kitchen": minor
---

**Scheduler**: The planning engine now lives in its own package, `@gram-lang/scheduler`, which `@gram-lang/kitchen` uses:

- `layout(tasks, { miseEnPlace, rests })` lays a recipe's list of tasks out on a timeline, for any mise en place plan and any choice of waits, and reports what cannot work (a time paradox, a track contention, a working day pushed before its 24 hours)
- The choices (`MISE_EN_PLACE_MODES`, `REST_CHOICES`, their defaults and guards) and the task types (`TaskGraph`, `Task`, `TaskDuration`) are exported too
- Compiled recipes keep every field published in 1.3.0 unchanged, and everything `@gram-lang/kitchen` exported before is still exported from it
- `project(recipes, context)` places a recipe on the calendar: it takes a serving time, a time zone and when the cook is available, and returns each task with its date and time (UTC and local), stretching or shortening the waits written as a range so the cook's own work avoids the night, and reporting what it could not fix
- `runSheet(plan)` groups a plan, or a bare schedule, into the days of the recipe, the visits to the kitchen (a wait of an hour or more ends one) and the waits that go on without the cook; with the graph and the context, it also says how early each visit could be done, and which exact wait holds it in place
- `findServeTimes()` tries each day of a range at your meal times and ranks the serving times that work, with the reasons of the others; `earliestServe()` gives the first one that works if the cook starts now
