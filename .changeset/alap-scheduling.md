---
"@gram-lang/kitchen": minor
"@gram-lang/docs": minor
---

Added support for ALAP (As Late As Possible) scheduling. Passive timers and their dependencies are now natively pushed backwards from the end of the recipe, ensuring ingredients are prepared just-in-time rather than sitting idle on the counter. Also introduces two new compiler warnings for timeline conflicts: `TIME_PARADOX` and `TRACK_CONTENTION`.
