---
"@gram-lang/cli": patch
---

Reduced the AI cost of `gram import`:
- Its system prompt — resent in full on every retry, up to 3 times per import — is now marked as cacheable for Anthropic models, so retries reuse the cached prompt instead of paying full price again.
- It now sends a minimal, pre-cleaned payload (title, ingredients, instructions, and a few other fields) instead of the entire raw JSON-LD recipe object, which on real-world sites can carry image URLs, ratings, and full-text reviews that dwarf the actual recipe content.
- Its self-correction loop now only retries the AI on real structural defects (undefined references, scope conflicts), not on every compiler warning — informational warnings like "not yet in your database" are expected on a fresh import and aren't something the AI can fix.
- Formatting (spacing, trailing decimal zeros, blank lines...) is now applied deterministically via the same formatter `gram format` uses, instead of spending an AI call asking the model to fix it.
