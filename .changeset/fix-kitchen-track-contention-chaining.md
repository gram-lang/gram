---
"@gram-lang/kitchen": patch
---

Fixed a spurious `TRACK_CONTENTION` warning on the ordinary, intended use of named passive tracks (`~_name{...}`) — chaining several steps on the same physical resource (an oven, a fridge shelf) back-to-back no longer warns just because nothing else linked those steps together. The scheduler now understands that shared-track ordering the same way it already understands `&intermediate` dependencies, so the warning only fires when a real, unforeseen conflict remains.
