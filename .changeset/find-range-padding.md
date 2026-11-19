---
"@gram-lang/cli": patch
---

**CLI**: Fixed `gram plan --find` rejecting single-digit hours (such as `9:00`), accepting impossible times (such as `25:99`), and failing late on out-of-range `availability` times (such as `24:30`).
