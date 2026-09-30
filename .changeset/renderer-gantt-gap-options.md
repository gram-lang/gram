---
"@gram-lang/renderer": patch
---

**Rendering**: The Gantt chart options `gapThresholdMinutes` and `compressedGapSize` now do what they describe, everywhere on the chart:

- `compressedGapSize` sets how wide a compressed wait is left; it was ignored
- `gapThresholdMinutes` now applies to the chart's width and the blocks' positions too, not only to the axis; with a value above the longest wait, the blocks used to run far past the chart's edge
- A missing, `NaN` or negative value falls back on the default
