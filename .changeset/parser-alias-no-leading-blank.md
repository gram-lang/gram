---
"@gram-lang/parser": minor
---

**Parser**: A component alias now starts right after the colon, with no blank (`@dry white wine:wine{10ml}`, `#cast iron skillet:skillet{}`); a colon followed by a space or a tab is ordinary punctuation. `Heat the #pan: then add oil.` read `then add oil.` as the alias of `pan`, and that text vanished from the step without a word; it now stays in the step. A recipe that wrote an alias after a blank (`@salt: fleur de sel{1g}`) should glue it to the colon (`@salt:fleur de sel{1g}`).
