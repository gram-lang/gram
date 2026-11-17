---
"@gram-lang/parser": minor
"@gram-lang/kitchen": minor
"@gram-lang/analyzer": minor
"@gram-lang/renderer": minor
"@gram-lang/format": minor
"@gram-lang/cli": minor
"gram-lang": minor
---

**Parser & Kitchen**: A step can now say when it is done with a target state, the texture, color or smell that ends it, and a glued note on how to check it: `Whisk until ={ribbon stage}(the batter falls back in a continuous ribbon).`:
  - Only the state goes between the braces; the note must touch the `}` and ends on the same line. An empty or unclosed `={` is a readable syntax error, and a name written without braces now ends before a target state (`@salt until ={taste}`).
  - The compiled step content gets a `checkpoint` token for each target state (`state`, and `note` when there is one); nothing else in the recipe changes: no scaling, no effect on the schedule or the shopping list.
  - Every view shows the target state in the sentence, on screen, in Markdown, in plain text and in print. `gram cook` shows what to look for under each step and reminds it when a timer of the step rings.
  - `gram diff` reports target states that were added, removed or changed, `gram import` writes them when the source gives one, and the editor highlights them.
