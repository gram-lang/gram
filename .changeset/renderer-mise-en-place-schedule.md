---
"@gram-lang/renderer": minor
"@gram-lang/i18n": minor
---

**Rendering**: The mise en place can now be planned right before each section, or all at the start:

- New `schedule` option (`"perSection"` by default, or `"upfront"`) on the HTML, Markdown and print outputs and on the Gantt chart
- By section, the HTML view shows on each section's ingredient list that its mise en place happens there (with the duration on hover), and the Gantt places it just before that section, even while an earlier step is still resting
- At the start, the Gantt puts all preparations first; the ingredient lists are the same in both modes
- Total and idle times follow the chosen schedule, and the total time tooltip now lists the mise en place of each section
