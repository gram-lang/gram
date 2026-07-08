---
"@gram-lang/kitchen": patch
"@gram-lang/cli": patch
---

Fixed `applyScale()` squaring the scaled quantity of every regular (non-composite, non-alternative) ingredient inside `sections[].ingredients` and its inline step token, because both point to the same shared `Usage` object and were each scaled independently. The aggregated shopping list total was already correct — only the per-section/per-step quantities were affected. This silently doubled the exponent of every `--scale` factor shown in `gram view`, `gram scale`, `gram print`, and `gram export` (e.g. `--scale 2` on a `200g` ingredient displayed `800g` instead of `400g`).
