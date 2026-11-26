---
"@gram-lang/modules": minor
"@gram-lang/language-server": minor
---

**Language Server**: The editor now flags four writing mistakes that the compiler accepts without a word, each documented in the warnings reference, and can add an unknown ingredient to the database:
  - `LOST_INGREDIENT` (warning): an ingredient written after a `//` in the middle of a step, which turns the rest of the line into a comment and silently drops it from the recipe.
  - `MERGED_STEP_LINE` (info): a `[Action]` line, a `## …` heading or the line after a `->&name` written right under a step with no blank line, so it is read as part of that step; the preferred Quick Fix inserts the blank line.
  - `SUSPECT_INGREDIENT_NAME` (hint): an ingredient name in braces that reads like a sentence (punctuation, more than 6 words or 40 characters), with a Quick Fix that moves the rest into the preparation.
  - `UNREAD_FRONTMATTER` (warning): a `# …` or indented line that made the whole frontmatter plain text, title included.
  - An unknown ingredient gets a second Quick Fix that adds a commented entry to the ingredient database (`database:` of `.gram/config.yaml`, else `.gram/ingredients.yaml`), written as `documentChanges` for editors that support them.
