---
"@gram-lang/cli": minor
---

**CLI / Plan**: A new `gram plan <recipe>` command plans a recipe: the days of work, the visits to the kitchen, what to take out and which steps of each section to read:

- `--serve "2026-10-11 13:00"` plans it backward from the time it is served; without it, the plan is told in days before the service (D-2, D-1, day D) and ends with the earliest time it could be ready if you start now
- `--tz Europe/Paris` sets the time zone; by default it is the new `timezone` setting of `.gram/config.yaml` (or of your global config), and only then this machine's. `--available` says when you can cook, as many times as needed: `08:00-22:00` for every day, `fri=18:00-22:00` for a day of the week, `2026-10-09=none` for a date (nothing means all day)
- A wait written as a range (`~_{8-16h}`) is made longer or shorter to keep your own work out of the hours you are not available, and the plan says which one and why; what cannot be fixed is listed at the top
- `--find 2026-10-12/2026-10-15` lists the serving times that work between two moments, at your meal times (`--meal-times 12:30,20:00`, or the new `mealTimes` setting of `.gram/config.yaml`), best first, and why each of the others does not
- `--format text|md|html|json` picks the output, and `--ics plan.ics` also writes a calendar file with an event for every visit to the kitchen, an alarm before it, and the lists in its description
- `--mise-en-place`, `--rests`, `--scale` and `--stock` work as they do in `gram view`; the mise en place mode also decides what goes in each visit's list of things to take out
- `gram export` and `gram print` accept `--with-sheet` (with `--serve`, `--tz` and `--available`) to write the work plan after the recipe, in the same document, one day per page when printed
