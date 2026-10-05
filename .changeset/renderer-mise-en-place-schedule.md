---
"@gram-lang/renderer": minor
"@gram-lang/i18n": minor
---

**Rendering**: The mise en place can now be planned right before each section, all at the start, or at the start of each working day:

- New `miseEnPlace` option (`"perSection"` by default, `"upfront"` or `"perSession"`) on the HTML, Markdown and print outputs and on the Gantt chart, and a new `rests` option (`"shortest"` by default, `"balanced"` or `"longest"`) for the waits written as a range (`~_{12-24h}`)
- By section, the HTML view shows on each section's ingredient list that its mise en place happens there (with the duration on hover), and the Gantt places it just before that section, even while an earlier step is still resting
- At the start, the Gantt puts all preparations first; the ingredient lists are the same in every mode
- At the start and by working day, the HTML, Markdown and print outputs open each session with a "Mise en place" block listing what is gathered for each section (labelled D-3, D-1... when the recipe spans several days), and the Gantt marks each day
- Total and idle times follow the chosen schedule, and the total time tooltip now lists the mise en place of each section (it no longer details the active time and the timers)
- The preparation tooltips follow the display language and the duration format you pass: no more space before the colon in English, no more fixed `1min`, and a preparation's duration is no longer shown twice
- A recipe placed on the calendar can be drawn: the Gantt chart takes the plan of `project()` (new `projection` option), shows a wait that was stretched or shortened at its new length with a note saying why, reads its axis in real days and times, and greys out the hours you are not available
- A recipe placed on the calendar reads as a recipe with its times: the new `projection` option of `toHTML`, `toMarkdown` and `toPrintHTML` writes when it is served and what could not be fixed at the top, a time next to every step, the day when it changes, and what each step leaves resting (with a note on a wait that was stretched or shortened); the total and idle times in the header are those of the plan. The new `runSheet` option also writes the production sheet after the recipe, the two in one document
- New `runSheetToText`, `runSheetToMarkdown`, `runSheetToHTML` and `runSheetToPrintHTML` write the production sheet of a plan: each day of the plan with its tasks in order, times rounded to the nearest five minutes ("around 21:40"), a note on every wait that was moved, and a list of what could not be fixed, in English or French
