---
"@gram-lang/parser": minor
"@gram-lang/kitchen": minor
"@gram-lang/analyzer": minor
"@gram-lang/renderer": minor
"@gram-lang/format": minor
"@gram-lang/cli": minor
"gram-lang": minor
---

**Parser & Kitchen**: Steps can now mark inline target states with an optional glued verification note (`Whisk until ={ribbon stage}(the batter falls back in a continuous ribbon).`):
  - Only the state sits inside `={…}`, with an optional single-line note attached to `}`; unclosed or empty `={` raises a syntax error, and braceless `@ingredient` names end before a target state (`@salt until ={taste}`).
  - Compiled steps emit a `checkpoint` token (`state`, plus optional `note`) without affecting scaling, scheduling, or the shopping list.
  - Rendered across HTML, Markdown, plain text, and print views; `gram cook` shows checkpoints below each step and reminds you when a step timer rings.
  - `gram diff` tracks added, removed, and changed target states, `gram import` preserves them from sources, and editors highlight them.
