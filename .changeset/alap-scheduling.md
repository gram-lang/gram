---
"@gram-lang/kitchen": minor
"@gram-lang/docs": minor
---

**Features:**
- Implemented **ALAP (As Late As Possible) scheduling** for recipe compilation. Passive timers and their dependencies are now natively pushed backwards from the end of the recipe to ensure ingredients are prepared *just-in-time*, preventing them from sitting idle on the kitchen counter.
- **Named Tracks** (sequential background tasks) now automatically benefit from ALAP and interleave correctly without blocking the active timeline.
- ALAP scheduling is now **global across the whole recipe** instead of resolved section-by-section: a single backward pass flattens every step in the recipe, so a dependency produced in one section and consumed several sections later is scheduled just-in-time exactly like an intra-section one.
- Section-level **retro-planning** (`## Section ~{-2d}`) now actually drives scheduling instead of being purely decorative metadata: it acts as a deadline anchor, pushing the section (and everything it depends on) as far back as needed so its work finishes no later than the anchor — the perfect tool for a dough that must rest overnight or a stock made two days ahead.
- Two new warnings surface scheduling conflicts, both non-blocking by default and promoted to errors by `gram check --strict`, like every other compiler warning:
  - `TIME_PARADOX`: a section's retro-planning anchor conflicts with a later dependency that mathematically requires it even earlier — the dependency wins and the anchor is overridden.
  - `TRACK_CONTENTION`: two named background tasks (e.g. sharing the same oven track) end up overlapping once retro-planning reorders sections chronologically; the serialization delay is reported instead of silently produced.
- Named Tracks are now re-serialized in real chronological order (not source order) once every step's absolute timing is known, so sequential background tasks stay correctly ordered even when retro-planning pulls a section far ahead of or behind its position in the file.
- The compiled `timings.start`/`timings.end` contract is unchanged (always positive, `0` at the earliest scheduled moment) — internally the engine computes the schedule backward from the recipe's end and rebases it forward, so existing consumers (renderer, Gantt view, CLI) need no changes.

**Documentation:**
- Added a new Deep Dive guide explaining the ALAP algorithm with interactive Mermaid Gantt charts in both English and French.
- Updated the compiler and timer syntax documentation to accurately reflect the new global backward-pass dependency tracking, the four scheduling phases, and the `TIME_PARADOX`/`TRACK_CONTENTION` warnings.
