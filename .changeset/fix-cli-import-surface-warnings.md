---
"@gram-lang/cli": patch
---

`gram import` now reports the compiler warnings left in its output (e.g. "not found in database" for a freshly imported ingredient) instead of silently discarding them. This information was already being computed internally to decide whether to retry the AI, but was never shown to the user; a recent change also stopped retrying the AI on non-structural warnings, which made this gap more noticeable. The report is now labeled "Warnings" instead of the previous "Could not parse", which was never accurate for this kind of message.
