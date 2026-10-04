---
"@gram-lang/renderer": minor
"@gram-lang/i18n": minor
---

**Rendering**: The mise en place can now be planned right before each section, all at the start, or at the start of each working day:

- New `schedule` option (`"perSection"` by default, `"upfront"` or `"perSession"`) on the HTML, Markdown and print outputs and on the Gantt chart
- By section, the HTML view shows on each section's ingredient list that its mise en place happens there (with the duration on hover), and the Gantt places it just before that section, even while an earlier step is still resting
- At the start, the Gantt puts all preparations first; the ingredient lists are the same in every mode
- At the start and by working day, the HTML, Markdown and print outputs open each session with a "Mise en place" block listing what is gathered for each section (labelled D-3, D-1... when the recipe spans several days), and the Gantt marks each day
- Total and idle times follow the chosen schedule, and the total time tooltip now lists the mise en place of each section (it no longer details the active time and the timers)
- The preparation tooltips follow the display language and the duration format you pass: no more space before the colon in English, no more fixed `1min`, and a preparation's duration is no longer shown twice
