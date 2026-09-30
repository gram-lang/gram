---
"@gram-lang/kitchen": minor
---

**Kitchen**: Recipes now know when each part of the mise en place should happen:

- Each section reports how long its own preparation takes (new `miseEnPlace` field)
- Two complete timelines are provided: preparation right before each section (`schedules.perSection`) or all of it at the start (`schedules.upfront`)
- A section without any step carries no preparation time (its share moves to the first section that has steps), so a recipe with no step at all now has a preparation time of 0
- An intermediate (`&dough`) is gathered in the section that uses it, whether it is declared on the section title or at the end of a step
- An ingredient, a piece of cookware and an alternative (`a|b`) that share a name are no longer mixed up when splitting the preparation by section
- The compiled recipe now says which version produced it (new `generator` field)
- Step `timings`, `backgroundTasks` and the `metrics` time breakdowns are deprecated and will be removed in 2.0.0 — read `schedules` instead
