---
"@gram-lang/renderer": minor
---

**Renderer / Views**: A new `prepareViews()` gathers everything a view of a recipe is built from, worked out once and only when a view asks for it:

- the timeline for the chosen settings and its total and idle times, the same at any serving time
- the work plan, on the calendar when a serving time is given, otherwise in days before the service
- the serving time search (the earliest serving time, and the times worth proposing in a range) from your kitchen's time zone and hours
