---
"@gram-lang/cli": minor
---

**CLI / View**: `gram view` now shows the recipe the way every other view of Gram does, and in your language:

- The headings, the labels and the nutrition follow the language of your project, instead of always being English
- The text of each step repeats the quantity next to each ingredient (`flour (200 g)`), as in the exported recipe; `--step-quantities hide` (or `--no-step-qty`) leaves them out
- Comments are shown, as notes under the recipe; `--comments hide` leaves them out
- An ingredient with an alternative is written in full (`egg or egg substitute`) where it used to read "alternative", a section brought in from another module says where it comes from, and a nutrition table with nothing in it is no longer printed
- A wait written as a range (`8-16 h`) is shown as written, and the duration the schedule retains is left to the run sheet, so the `(~8h)` that followed such a step is gone
- The colors follow your terminal: nothing but plain text is written when the output goes to a file or another command, `NO_COLOR` is respected, and `FORCE_COLOR=1` keeps them for `gram view | less -R`
