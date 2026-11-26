---
"@gram-lang/i18n": patch
"@gram-lang/kitchen": patch
---

**Kitchen & i18n**: A timer written with a decimal numerator (`~{1.5/2 min}`, `~{1,5/2 h}`) now has its duration, 0.75 min and 45 min, as `{1.5/2 cups}` already gives 0.75 cup for an ingredient. It was refused with `INVALID_DURATION` and counted for nothing in the schedule. The denominator stays a whole number, and `parseDuration` reads such a fraction the same way.
