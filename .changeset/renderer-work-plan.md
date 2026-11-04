---
"@gram-lang/renderer": minor
"@gram-lang/i18n": minor
---

**Rendering / Planning**: A new work plan shows what the scheduler computed, and replaces the Gantt chart as the view of the planning:

- `runSheetToText`, `runSheetToMarkdown`, `runSheetToHTML` and `runSheetToPrintHTML` write the plan: the planning of the days, then for each visit to the kitchen a worksheet in three parts: the mise en place (ingredients, preparations made before, bases in stock, cookware), the execution (the steps of each section, numbered as in the recipe, with their actions, temperatures and timers, and the time the section starts) and what to do on leaving (what goes on afterwards, and when to come back)
- What to take out follows the mise en place mode of the plan: by section, each section is a station with its own things to take out, right before its steps (the cookware once, at the first section that uses it); per working day, everything the day needs is listed together, with the quantities summed, at the top of the day's first visit; upfront, all of them come out at the first visit. A preparation always comes out at the visit of the first step that uses it
- Each visit says how early it could be done ("Possible from 18:00") or which exact wait holds it ("Fixed times"), and a wait the plan stretched or shortened is reported on its day, with the range you wrote
- A recipe with no serving time is told in days before the service (D-2, D-1, day D) and in durations; the HTML needs no script and the print document has one day per page (a long day runs over several pages, never cutting a step), with check boxes for the mise en place
- `describeRunSheet()` gives the same plan in words, and `visitKit()`, `sectionProgram()` and `sectionSteps()` are the three pieces (what to take out, which steps a visit covers, the steps written out) that another interface can reuse; `describeServeTimes()` and `describeEarliestServe()` word the search of serving times
- The `runSheet` option of `toHTML`, `toMarkdown` and `toPrintHTML` writes the work plan after the recipe, in the same document. The recipe views themselves show no schedule

**Deprecated**

- Renderer: the Gantt chart (`toGanttHTML`, `attachGanttInteractivity`, `formatTime`, `formatAxisTime`, the `Gantt*` types), `@gram-lang/renderer/gantt.css` and the `gantt_*` strings of the playground, removed in 2.0.0. No Gram surface draws it any more. Use the work plan (`runSheetToHTML`), or build a view of your own from the data of `runSheet()`; `toGanttHTML` warns once on the console. The Deprecated features page shows how: https://gram-lang.org/docs/how-to/deprecations/

**Fixed**

- The Gantt chart options `gapThresholdMinutes` and `compressedGapSize` now do what they describe, everywhere on the chart: `compressedGapSize` sets how wide a compressed wait is left, `gapThresholdMinutes` applies to the chart's width and the blocks' positions too, and a missing, `NaN` or negative value falls back on the default
