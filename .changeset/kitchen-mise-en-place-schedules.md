---
"@gram-lang/kitchen": minor
---

**Kitchen**: Recipes now know when each part of the mise en place should happen:

- Each section reports how long its own preparation takes (new `miseEnPlace` field)
- Three complete timelines are provided: preparation right before each section (`schedules.perSection`), all of it at the start (`schedules.upfront`), or the preparation of each working day gathered at the start of that day (`schedules.perSession`, for recipes over several days)
- The days come from the sections' retro-planning anchors (`~{-2d}`, `~{-36h}`): a section without an anchor takes the day of the next one, and a recipe with no anchor of a day or more is a single session, like `upfront`
- Every timeline lists its working days in a new `sessions` field, and a preparation planned later than the rest of its section's (an intermediate made the same day) is flagged `deferred`
- A section without any step carries no preparation time (its share moves to the first section that has steps), so a recipe with no step at all now has a preparation time of 0
- An intermediate (`&dough`) is gathered in the section that uses it, whether it is declared on the section title or at the end of a step
- An ingredient, a piece of cookware and an alternative (`a|b`) that share a name are no longer mixed up when splitting the preparation by section
- New `computeMiseEnPlace(sections, registry)` gives the same split as the `miseEnPlace` field for sections you built yourself, and `calculatePreparationTime` can take its result as an optional third argument
- New `ScheduleMode`, `SCHEDULE_MODES`, `DEFAULT_SCHEDULE_MODE`, `isScheduleMode`, `scheduleFor` and `scheduleTimes` to choose between the timelines the same way everywhere (the renderer keeps re-exporting `ScheduleMode`; code that switches over every `ScheduleMode` value now has a third case)
- JSON compiled before 1.4.0, which has no `schedules`, still gets a total and idle time, read from its old `metrics` fields, in the renderer outputs, the editor hint and `gram diff` (its Gantt chart has nothing to draw)
- The compiled recipe now says which version produced it (new `generator` field)

**Deprecated**

- Kitchen: `steps[].timings` and `steps[].backgroundTasks`, removed in 2.0.0. Read the `step` and `passive` blocks of `schedules[mode].blocks` instead
- Kitchen: `metrics.totalTime` and `metrics.idleTime`, removed in 2.0.0. Read `schedules[mode].totalTime` and `schedules[mode].idleTime` instead (the old `metrics.totalTime` is the total with every preparation first: `schedules.upfront` gives the same number unless the recipe has intermediates, which it prepares once they exist)
- Kitchen: `metrics.activeBreakdown`, `metrics.prepBreakdown` and `metrics.totalBreakdown`, removed in 2.0.0. Use `miseEnPlace` and `schedules` instead
- Kitchen: the `breakdown` returned by `calculatePreparationTime`, removed in 2.0.0 (the function then returns `{ total }`, so code reading `total` is unaffected). Read the `items` of `computeMiseEnPlace()` instead
- Kitchen: reading the old `metrics` fields when compiled JSON has no `schedules` (JSON compiled before 1.4.0), removed in 2.0.0. Compile your recipes again with 1.4.0 or later
- Everything above keeps working, with the same values, until 2.0.0. The Deprecated features page shows what to change for each of them: https://gram-lang.org/docs/how-to/deprecations/
