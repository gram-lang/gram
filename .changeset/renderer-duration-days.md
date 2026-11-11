---
"@gram-lang/renderer": minor
"@gram-lang/i18n": minor
"@gram-lang/language-server": minor
---

**Rendering**: Durations read more naturally, in the reader's language:

- A duration of a day or more is written in days and hours, rounded to the hour: a recipe of 25 hours shows `1d 1h` (`1j 1h` in French) instead of `25h 6m`
- The total time tooltip keeps hours and minutes and ends on the exact total (`= 25h 6min`), so its parts always add up and the rounded `1d 1h` of the pill reads as that same total
- Minutes are written `min` instead of `m` (`1h 30min`, `45min`), and the units follow the display language in every view: recipe, run sheet, Markdown, text and print
- `formatDuration()` takes the language as an optional second argument (`formatDuration(1506, "fr")` gives `1j 1h`) and `{ days: false }` as a third to keep hours and minutes; a new `durationUnits` entry of `@gram-lang/i18n` holds the units of each language
- The time labels are in sentence case (`Total time`, `Temps total`), and the Markdown recipe puts the space French wants before the colon (`**Temps total** : 1j 1h`)
- The total time hint in the editor, after the recipe's title, says the total as the views do, in the recipe's language
