---
"@gram-lang/cli": minor
---

**CLI / Plan**: A new `gram plan <recipe> --serve "2026-10-11 13:00"` command plans a recipe backward from the time it is served, and writes a production sheet with a time for every task:

- `--tz Europe/Paris` sets the time zone; by default it is the new `timezone` setting of `.gram/config.yaml` (or of your global config), and only then this machine's. Only `gram plan` reads the setting, and only complains when it is not a time zone, and `--available` says when you can cook, as many times as needed: `08:00-22:00` for every day, `fri=18:00-22:00` for a day of the week, `2026-10-09=none` for a date (nothing means all day)
- A rest written as a range (`~_{8-16h}`) is made longer or shorter to keep your own work out of the hours you are not available, and the sheet says which one and why; what cannot be fixed is listed at the end
- `--format text|md|html|json` picks the output, and `--ics plan.ics` also writes a calendar file with an event for every task and an alarm on the ones that need your hands
- `--mise-en-place`, `--rests`, `--scale` and `--stock` work as they do in `gram view`
- `gram view`, `gram export` and `gram print` accept `--serve`, `--tz` and `--available` too: the recipe then says when each step happens (a time next to every step, the day when it changes, the rests with the note of one that was stretched, and when it is served and what could not be fixed at the top), and its total time is the plan's. In `gram export` and `gram print`, `--with-sheet` also writes the production sheet after the recipe, in the same document

