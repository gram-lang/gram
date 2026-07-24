---
"@gram-lang/kitchen": patch
---

Fixed several compiler correctness bugs:

- An empty section (or one containing only a comment) between two sections with steps used to break ALAP scheduling: the step right after the gap could get scheduled to overlap a timer still running from before the gap. It now correctly chains past the gap.
- `applyScale()` (used by `gram scale` and the playground) now scales cookware quantities. Previously it only scaled cookware "by accident" when called from inside `compile({ scaleFactor })`, so `applyScale(compile(recipe), factor)` silently left cookware unscaled.
- A timer with an unrecognized time unit (e.g. `~{3 bananas}`) or a missing unit no longer silently contributes a fabricated duration to the recipe's total/active time. Both now raise a warning instead, matching how temperatures and retro-planning already behave.
- Timer units are now displayed consistently (e.g. always "min", never a mix of "min"/"mins"/"minutes" for the same physical duration in the same recipe).
