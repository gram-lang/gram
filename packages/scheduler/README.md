# @gram-lang/scheduler

*Part of the [Gram monorepo](https://git.gram-lang.org/gram-lang/gram).*

The scheduling engine behind Gram recipes. It lays tasks out on a timeline (as-late-as-possible backward pass, named-track contention, mise en place placement, working days) from a neutral description of the work, and knows nothing about the Gram AST or the compiled recipe: `@gram-lang/kitchen` feeds it and writes the result into the compiled JSON.

- `layout(tasks, { miseEnPlace, rests })` lays a task graph out on a timeline, in minutes from the start.
- `project([{ graph }], { serveAt, timeZone, availability })` places that timeline on the calendar, ending at the serving time, and moves the rests written as a range so the cook's own work falls when they are available. It reads no clock and no time zone of the machine: the same input always gives the same plan.
- `runSheet(plan | schedule, { graph, context })` groups a plan (or a bare schedule, in days before the service) into the days, the visits to the kitchen and the threads that go on without the cook, with the margin of each visit.
- `findServeTimes()` and `earliestServe()` try serving times with `project()` and tell which can be followed, and why the others cannot.
- `parseAvailability()`, `parseMealTimes()`, `isTimeZone()`, `availabilityEntries()` and `isCalendarDate()` read and check a project's settings (`08:00-22:00`, `fri=18:00-22:00`, `2026-10-09=none`), so the CLI and the editor read them the same way; a date that does not exist (a 30th of February) is refused instead of moved to the next month.
- Each visit of the run sheet lists the sections it cooks and when each starts, and `visitSections()` gives the sections to name a visit after.
- `MISE_EN_PLACE_MODES` (`perSection`, `upfront`, `perDay`) and `REST_CHOICES` (`shortest`, `balanced`, `longest`) are the choices `layout()` takes, with their defaults and guards.
