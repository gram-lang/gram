---
"@gram-lang/kitchen": minor
---

**Kitchen**: Recipes now know when each part of the mise en place should happen:

- Each section reports how long its own preparation takes (new `miseEnPlace` field)
- Two complete timelines are provided: preparation right before each section (`schedules.perSection`) or all of it at the start (`schedules.upfront`)
- The compiled recipe now says which version produced it (new `generator` field)
- Step `timings`, `backgroundTasks` and the `metrics` time breakdowns are deprecated and will be removed in 2.0.0 — read `schedules` instead
