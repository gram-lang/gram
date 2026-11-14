---
"@gram-lang/cli": patch
---

**CLI / Import**: `gram import` now writes hours and minutes the way a cook would (`~{1h30}`, `~{45min-1h}`, anchors such as `~{-1h30}`), and avoids durations Gram cannot read, such as `~{1:30}`.
