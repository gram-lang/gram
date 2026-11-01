---
"@gram-lang/scheduler": minor
"@gram-lang/renderer": patch
---

**Work plan**: Fixed the work plan in "All at the start" and "Per day" modes, so each visit and each day now shows what is really done:
- A visit is named after the sections cooked in it, no longer after a section whose equipment is only taken out there (for example "Baking" no longer appears on the day the batter is made)
- Without a serving time, a visit after a long rest now falls on its own day (for example D-1 for the batter and Day D for the baking), as it does with a serving time
- Scheduler: each visit now also lists the sections it cooks (`worked`), and `visitSections()` gives the sections to name a visit after
