---
"@gram-lang/cli": patch
---

**CLI**: `gram plan --find` now reads a bound whose hour has one digit as the time it is: `--find "2026-10-12 9:00/2026-10-12 10:00"` was refused as out of order, an impossible time such as `25:99` was accepted, and a time outside the day in the `availability` setting (`24:30`) is now refused with a message instead of failing later.
