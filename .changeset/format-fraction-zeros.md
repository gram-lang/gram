---
"@gram-lang/format": patch
---

**Format**: The formatter no longer removes the trailing zeros of a fraction's terms (`~{1.0/5 min}`, `~{1/5.0 min / 500 g @&b}`). The compiler does not read these as a duration, but it reads the trimmed `1/5` as one, so formatting changed the timer. Ratios keep being trimmed (`{1.50 / 100.0 g @&b}` → `{1.5 / 100 g @&b}`).
