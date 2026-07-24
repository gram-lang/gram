---
"@gram-lang/kitchen": patch
---

Scaling a recipe by an extreme factor now fails with a clear error instead of silently producing `Infinity` (serialized as `null` in the output JSON). Scaled quantities are also rounded consistently, including a composite ingredient's total, so results no longer show float noise like `110.00000000000001`.
