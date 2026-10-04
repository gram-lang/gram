---
"@gram-lang/scheduler": minor
"@gram-lang/kitchen": minor
---

**Scheduler**: The planning engine now lives in its own package, `@gram-lang/scheduler`, which `@gram-lang/kitchen` uses:

- `layout(tasks, { miseEnPlace, rests })` lays a recipe's list of tasks out on a timeline, for any mise en place plan and any choice of rests, and reports what cannot work (a time paradox, a track contention, a working day pushed before its 24 hours)
- The choices (`MISE_EN_PLACE_MODES`, `REST_CHOICES`, their defaults and guards) and the task types (`TaskGraph`, `Task`, `TaskDuration`) are exported too
- Compiled recipes keep every field published in 1.3.0 unchanged, and everything `@gram-lang/kitchen` exported before is still exported from it
