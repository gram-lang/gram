---
"@gram-lang/kitchen": patch
---

**Kitchen**: An intermediate is now linked to the step that makes it the way a reference resolves, ignoring case and accents, so the schedule no longer loses the link between them:
  - `->&Dough` then `&dough{}` (or `->&Pâte{}` then `&pate{}`) now makes the step wait for the dough, as `&Dough{}` already did.
  - A loop written with different cases (`&A` in the section making `b`, `&B` in the one making `a`) is now reported as a circular reference.
  - In the compiled recipe, the task graph names intermediates and ingredient references by their id (`produces`, `consumes`, `intermediate`: `creme-anglaise`, `flour` for `&@Flour`), so `gram format` no longer changes it.
