---
"@gram-lang/cli": patch
---

Reduced the AI cost of `gram import`. The command can send its full recipe-syntax prompt to the model up to three times per import (an initial conversion attempt plus up to two self-correction retries), and that prompt was resent from scratch in full every time. It's now marked as cacheable for Anthropic models, so retries within the same import — and repeated imports in the same session — reuse the cached prompt instead of paying full price for it again.
