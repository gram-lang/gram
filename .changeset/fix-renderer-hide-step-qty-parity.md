---
"@gram-lang/renderer": patch
---

The `hideStepQty` rendering option (hides ingredient quantities from step text) now works with `toHTML` and `toMarkdown`, not just `toPrintHTML` — it was previously silently ignored by the other two.
