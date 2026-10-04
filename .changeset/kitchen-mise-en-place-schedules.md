---
"@gram-lang/kitchen": minor
---

**Kitchen**: Recipes now know when each part of the mise en place should happen:

- Each section reports how long its own preparation takes (new `miseEnPlace` field)
- A recipe carries its list of tasks and what each one waits for (new `tasks` field), and a default timeline laid out from it (new `schedule` field): the preparation right before each section, the shortest rests
- Any other timeline comes from the same list, without compiling again: all the preparation at the start (`upfront`), or the preparation of each working day gathered at the start of that day (`perSession`, for recipes over several days), with the shortest, middle or longest of every rest written as a range (new `layout()`, from `@gram-lang/scheduler`)
- A timer is exact: `~_{12h}` lasts exactly 12 hours. A rest written as a range (`~_{12-24h}`) is planned on its shortest figure unless you pick another; an active timer written as a range (`~{20-25min}`) is always planned on its longest, so dinner is never late
- Only an anchor in days (`~{-1d}`, `~{-2d}`) opens a working day; an anchor in hours (`~{-18h}`, `~{-36h}`) is a deadline inside the day the section falls on. A section without an anchor takes the day of the furthest anchor in days after it, and a recipe with no anchor in days is a single session, like `upfront`
- A new `SESSION_OVERFLOW` warning flags a working day pushed before its 24 hours by a long rest, and suggests anchoring the section further back
- Every timeline lists its working days in a new `sessions` field, and a preparation planned later than the rest of its section's (an intermediate made the same day) is flagged `deferred`
- A section without any step carries no preparation time (its share moves to the first section that has steps), so a recipe with no step at all now has a preparation time of 0
- An intermediate (`&dough`) is gathered in the section that uses it, whether it is declared on the section title or at the end of a step
- An ingredient, a piece of cookware and an alternative (`a|b`) that share a name are no longer mixed up when splitting the preparation by section
- New `computeMiseEnPlace(sections, registry)` gives the same split as the `miseEnPlace` field for sections you built yourself, and `calculatePreparationTime` can take its result as an optional third argument
- New `MiseEnPlaceMode`, `MISE_EN_PLACE_MODES`, `DEFAULT_MISE_EN_PLACE_MODE`, `isMiseEnPlaceMode`, `RestChoice`, `REST_CHOICES`, `scheduleFor` and `scheduleTimes` to choose between the timelines the same way everywhere (the renderer keeps re-exporting `MiseEnPlaceMode`)
- JSON compiled before 1.4.0, which has no `tasks`, still gets a total and idle time, read from its old `metrics` fields, in the renderer outputs, the editor hint and `gram diff` (its Gantt chart has nothing to draw)
- The compiled recipe now says which version produced it (new `generator` field)

**Deprecated**

- Kitchen: `steps[].timings` and `steps[].backgroundTasks`, removed in 2.0.0. Read the `step` and `passive` blocks of `schedule.blocks` instead
- Kitchen: `metrics.totalTime` and `metrics.idleTime`, removed in 2.0.0. Read `schedule.totalTime` and `schedule.idleTime` instead (the old `metrics.totalTime` is the total with every preparation first: `layout(tasks, { miseEnPlace: "upfront" })` gives the same number unless the recipe has intermediates, which it prepares once they exist)
- Kitchen: `metrics.activeTime`, removed in 2.0.0. Read `schedule.activeTime` instead (a timer written as a range counts as its average in `metrics.activeTime`, and as its longest figure in the schedule)
- Kitchen: `metrics.activeBreakdown`, `metrics.prepBreakdown` and `metrics.totalBreakdown`, removed in 2.0.0. Use `miseEnPlace` and `schedule` instead
- Kitchen: the `breakdown` returned by `calculatePreparationTime`, removed in 2.0.0 (the function then returns `{ total }`, so code reading `total` is unaffected). Read the `items` of `computeMiseEnPlace()` instead
- Kitchen: reading the old `metrics` fields when compiled JSON has no `tasks` (JSON compiled before 1.4.0), removed in 2.0.0. Compile your recipes again with 1.4.0 or later
- Everything above keeps working, with the same values, until 2.0.0. The Deprecated features page shows what to change for each of them: https://gram-lang.org/docs/how-to/deprecations/
