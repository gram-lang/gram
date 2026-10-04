# @gram-lang/scheduler

*Part of the [Gram monorepo](https://git.gram-lang.org/gram-lang/gram).*

The scheduling engine behind Gram recipes. It lays tasks out on a timeline (as-late-as-possible backward pass, named-track contention, mise en place placement, working-day sessions) from a neutral description of the work, and knows nothing about the Gram AST or the compiled recipe: `@gram-lang/kitchen` feeds it and writes the result into the compiled JSON.

- `layout(tasks, { miseEnPlace, rests })` lays a task graph out on a timeline, in minutes from the start.
- `project([{ graph }], { serveAt, timeZone, availability })` places that timeline on the calendar, ending at the serving time, and moves the rests written as a range so the cook's own work falls when they are available. It reads no clock and no time zone of the machine: the same input always gives the same plan.
- `runSheet(plan)` gives the structure of a production sheet from a plan.
