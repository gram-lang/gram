---
"@gram-lang/renderer": minor
"@gram-lang/i18n": minor
---

**Rendering**: The mise en place can now be planned right before each section, all at the start, or at the start of each working day:

- New `miseEnPlace` option (`"perSection"` by default, `"upfront"` or `"perSession"`) on the HTML, Markdown and print outputs, and a new `rests` option (`"shortest"` by default, `"balanced"` or `"longest"`) for the waits written as a range (`~_{12-24h}`)
- The ingredient lists are the same in every mode: the recipe says how, and what to take out and when is the work plan's
- Total and idle times follow the chosen schedule, and the total time tooltip now lists the mise en place of each section (it no longer details the active time and the timers)
- The preparation tooltips follow the display language and the duration format you pass: no more space before the colon in English, no more fixed `1min`, and a preparation's duration is no longer shown twice
