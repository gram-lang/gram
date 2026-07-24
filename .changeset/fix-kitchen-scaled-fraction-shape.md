---
"@gram-lang/kitchen": patch
---

Scaling a fraction quantity (e.g. `1/2 cup`) no longer produces a malformed value in the compiled JSON (`{"type": "fraction", "value": 1}` with no numerator/denominator) — it's now correctly represented as a plain numeric quantity.
