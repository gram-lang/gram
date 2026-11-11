---
"@gram-lang/renderer": minor
"@gram-lang/i18n": minor
---

**Rendering**: The mise en place can now be planned right before each section, all at the start, or at the start of each working day:

- New `miseEnPlace` option (`"perSection"` by default, `"upfront"` or `"perDay"`) on the HTML, Markdown and print outputs, and a new `rests` option (`"shortest"` by default, `"balanced"` or `"longest"`) for the waits written as a range (`~_{12-24h}`)
- The ingredient lists are the same in every mode: the recipe says how, and what to take out and when is the run sheet's
- The total time follows the chosen schedule, and its tooltip explains how it adds up (preparation, active time and waits), then points to the run sheet for the hour-by-hour plan
- The recipe no longer shows the waiting time on its own, in HTML, Markdown, text and print alike: it is counted in the total time, and the run sheet is where the waits are planned. The preparation and active times stay
- The preparation tooltips follow the display language and the duration format you pass: no more space before the colon in English, no more fixed `1min`, and a preparation's duration is no longer shown twice
