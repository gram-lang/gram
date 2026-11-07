---
"@gram-lang/renderer": minor
"@gram-lang/i18n": minor
"@gram-lang/cli": minor
---

**Rendering**: The recipe can now be written as plain text, for a terminal or a plain file:

- A box with the title, the servings and the times, then the shopping list, the cookware, each section with its ingredients and its numbered steps, the notes and the nutrition, with the quantities lined up in a column
- Every word is in the reader's language, and the text follows the same settings as the other formats (comments, quantities in the steps, baker's percentages, nutrition basis, mise en place and rests)
- `gram export --format text` writes it next to the recipe (`brioche.txt`), and the playground offers it as a format of the recipe
- The Markdown, HTML and print versions of the recipe now speak the reader's language too: "Instructions", "Ingredients", "Metadata", "Total Mass", "or", "optional", "passive" and the other words that were always in English now follow the language setting (`Étapes`, `Ingrédients`, `Métadonnées`, `ou`, `optionnel`... in French). The English output is unchanged, and the run sheet gets the same words
- For developers: `toText()` and the `text` format of the recipe view; a `textStyle` option lets a terminal add its own colors, and `width` sets the width of the box and the rules
