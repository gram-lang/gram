---
"@gram-lang/kitchen": minor
---

**Kitchen**: A duration longer than 1000 years (a timer, or a section's retro-planning offset) no longer breaks the timeline:

- It is capped at 1000 years and the compiler warns with the new `DURATION_OUT_OF_RANGE` code; before, the times came out as `0` minutes, `Infinity` or `NaN` (`null` in the JSON) without any warning. Durations up to the limit are planned as written
- `quantityToMinutes` caps its result the same way, and `MAX_DURATION_MINUTES`, `isDurationTooLong` and `maxDurationIn` are exported
