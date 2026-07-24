---
"@gram-lang/renderer": minor
---

The Markdown, HTML, and printable/PDF outputs now show the same information consistently:

- Markdown recipes now include a nutrition summary (calories, carbs, protein, fat, etc.), which was previously only shown in HTML and print.
- Recipe comments now appear as numbered footnotes in Markdown and print output too, instead of only in HTML.
- When a shopping-list ingredient's purchasing weight differs from what actually goes in the bowl (e.g. "1 avocado" vs. its usable flesh), Markdown and print now show the extra "gross weight" note, matching HTML.
- When the same ingredient appears in incompatible units that can't be combined (e.g. "100g" and "1 cup" with no density available), Markdown and print now group them together with a "mixed units" warning, matching HTML.
