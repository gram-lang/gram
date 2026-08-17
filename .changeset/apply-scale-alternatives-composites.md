---
"@gram-lang/kitchen": patch
---

Fixed `gram scale` (and any other caller that re-scales an already-compiled recipe) silently leaving two kinds of ingredients unscaled: an alternative group (`@butter|@margarine`) and a composite child's record of how much of its parent it draws (`@egg-yolks{2}<@eggs{3}`). Both now scale correctly no matter how the scaling is triggered.
