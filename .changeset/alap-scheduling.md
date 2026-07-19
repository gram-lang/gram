---
"@gram-lang/kitchen": minor
"@gram-lang/docs": minor
---

**Features:**
- Implemented **ALAP (As Late As Possible) scheduling** for recipe compilation. Passive timers and their dependencies are now natively pushed backwards from the end of the recipe to ensure ingredients are prepared *just-in-time*, preventing them from sitting idle on the kitchen counter.
- **Named Tracks** (sequential background tasks) now automatically benefit from ALAP and interleave correctly without blocking the active timeline.

**Documentation:**
- Added a new Deep Dive guide explaining the ALAP algorithm with interactive Mermaid Gantt charts in both English and French.
- Updated the compiler and timer syntax documentation to accurately reflect the new backward-pass dependency tracking.
