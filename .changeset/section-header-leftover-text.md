---
"@gram-lang/parser": patch
---

**Parser**: A section header with text left after its anchor or intermediate now raises a clear error, instead of losing the section without a word or blaming the anchor:
  - `## Garnish ~{-10h} ->&glazed rhubarb` now asks for the braces a multi-word intermediate needs (`->&glazed rhubarb{}`), instead of reporting "Invalid quantity '{-10h}' for timer".
  - Without an anchor, the same header used to turn silently into a step, so the section vanished from the recipe.
  - A section header written on the very last line of a file, with no final line break, is now read as a header too.
