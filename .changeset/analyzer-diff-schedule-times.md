---
"@gram-lang/analyzer": minor
"@gram-lang/cli": minor
---

**Analyzer / Diff**: `gram diff` now compares the total and idle times of the default schedule, with the mise en place right before each section, so the times it reports match what `gram view` shows by default; the active time is the schedule's too, so changing the range of a cooking time (`~{20-25min}`, planned on its longest figure) shows in the comparison, and the preparation time is compared as before
