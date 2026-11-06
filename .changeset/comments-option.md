---
"@gram-lang/renderer": minor
"@gram-lang/i18n": minor
"@gram-lang/cli": minor
"@gram-lang/language-server": minor
"gram-lang": minor
---

**Comments**: You can now choose whether the comments of a recipe (`// like this`) are shown or left out, in every view:

- The renderer takes a new `comments: "show" | "hide"` option (default `"show"`): the recipe views, the print and the run sheet all follow it, and hiding leaves no empty notes section behind
- `gram export`, `gram print` and `gram plan` accept `--comments <show|hide>`
- A new `gram.comments` setting does the same for the VS Code preview and run sheet, and the playground gets a **Display** section with a switch
- In the run sheet, comments are set apart discreetly: a note alone on a line sits under its step in small muted text, and one at the end of a line stays in the sentence, between parentheses
