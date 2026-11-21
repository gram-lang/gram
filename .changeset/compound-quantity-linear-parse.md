---
"@gram-lang/parser": patch
---

**Parser**: Fixed a sum of quantities (`@flour{1 cup + 2 tbsp}`) whose parsing time grew with the square of its number of terms. It now grows in step with the length of the sum, so a very long one no longer slows down the editor on each keystroke.
