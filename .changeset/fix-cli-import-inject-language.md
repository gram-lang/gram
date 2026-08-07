---
"@gram-lang/cli": patch
---

`gram import` now sets the frontmatter `language` field to the actual configured target language deterministically after generation, instead of leaving it to the AI to notice and fill in (or skip) on its own — the CLI already knows this value with certainty, so there's nothing left to infer.
