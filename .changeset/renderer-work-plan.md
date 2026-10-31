---
"@gram-lang/renderer": minor
"@gram-lang/i18n": minor
---

**Rendering / Planning**: A new work plan shows what the scheduler computed, and replaces the Gantt chart as the view of the planning:

- `runSheetToText`, `runSheetToMarkdown`, `runSheetToHTML` and `runSheetToPrintHTML` write the plan: the planning of the days, then for each day and each visit to the kitchen what to take out (ingredients, preparations made before, bases in stock, cookware), which steps of each section to read in the recipe ("steps 1 to 3"), and what goes on afterwards
- What to take out follows the mise en place mode of the plan: by section, each section carries its own things to take out, right before its steps (the cookware once, at the first section that uses it); per working day, they are listed together at the top of the visit with the quantities summed; upfront, all of them come out at the first visit. A preparation always comes out at the visit of the first step that uses it
- Each visit says how early it could be done ("Possible from 18:00") or which exact wait holds it ("Fixed times"), and a wait the plan stretched or shortened is reported on its day, with the range you wrote
- A recipe with no serving time is told in days before the service (D-2, D-1, day D) and in durations; the HTML needs no script and the print document has one day per page, with check boxes
- `describeRunSheet()`, `visitKit()` and `sectionProgram()` give the same plan in words, and the two extractions another interface can reuse; `describeServeTimes()` and `describeEarliestServe()` word the search of serving times
- The `runSheet` option of `toHTML`, `toMarkdown` and `toPrintHTML` writes the work plan after the recipe, in the same document. The recipe views themselves show no schedule

**Deprecated**

- Renderer: the Gantt chart (`toGanttHTML`, `attachGanttInteractivity`, `formatTime`, `formatAxisTime`, the `Gantt*` types), `@gram-lang/renderer/gantt.css` and the `gantt_*` strings of the playground, removed in 2.0.0. No Gram surface draws it any more. Use the work plan (`runSheetToHTML`), or build a view of your own from the data of `runSheet()`; `toGanttHTML` warns once on the console. The Deprecated features page shows how: https://gram-lang.org/docs/how-to/deprecations/

**Fixed**

- The Gantt chart options `gapThresholdMinutes` and `compressedGapSize` now do what they describe, everywhere on the chart: `compressedGapSize` sets how wide a compressed wait is left, `gapThresholdMinutes` applies to the chart's width and the blocks' positions too, and a missing, `NaN` or negative value falls back on the default
