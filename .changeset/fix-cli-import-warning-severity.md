---
"@gram-lang/cli": patch
---

`gram import`'s self-correction loop now only asks the AI to retry on real structural defects (undefined references, scope conflicts) — the same bar `gram check` uses by default — instead of on every compiler warning. Informational warnings like "this ingredient isn't in your database yet" are expected on a fresh import and aren't something the AI can meaningfully fix, so retrying on them was wasting AI calls without improving the output.
