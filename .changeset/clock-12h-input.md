---
"@gram-lang/scheduler": minor
"@gram-lang/cli": minor
"@gram-lang/language-server": minor
---

**CLI & Scheduler**: Times of day can be written in 12 hours with am/pm, as well as in 24 hours, wherever a plan reads one:
  - `--available` and the `availability` setting take `8am-10pm`, `fri=8:30 am - 10:00 PM` or `sat=6pm-12am` (until midnight), and 12 and 24 hours can be mixed (`8am-22:00`).
  - `--meal-times` and the `mealTimes` setting take `12:30pm,8pm`; `--serve` takes `"2026-10-11 1:00 pm"`, and the bounds of `--find` take `"2026-10-12 6pm/2026-10-12 10pm"`. The serving time chosen in the editor reads the same forms.
  - Case and spaces don't matter (`8 AM`, `8:30pm`, `7 p.m.`); `12am` is midnight and `12pm` noon. `13pm`, `0am` or an hour alone (`8`) are refused with a message showing both forms.
  - The scheduler exports the readings it uses, `parseTimeOfDay` and `parseLocalDateTime`, for other tools to accept the same times.
