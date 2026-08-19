---
"@gram-lang/kitchen": patch
"@gram-lang/modules": patch
"@gram-lang/i18n": patch
---

**Parser & Kitchen**: Improved clarity and tone for diagnostic messages and revised severity tiers:
  - Reworded compiler and module diagnostic messages to provide actionable guidance and avoid alarmist phrasing for standard culinary approximations.
  - Reclassified non-critical notices (`MISSING_MACROS`, `UNKNOWN_MASS`, `TRACK_CONTENTION`) to `info` severity so they do not clutter warning counters.
  - Enhanced Playground and editor diagnostic styling with dedicated color schemes for errors (red), warnings (amber), and notices (blue).
