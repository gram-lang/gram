---
"@gram-lang/kitchen": patch
---

**Kitchen**: Two ways of writing a quantity that Gram used to misread silently now raise an `INVALID_UNIT` warning:
  - A quantity written as two, such as `@flour{1 cup 5 tbsp}`, which passed as one unknown unit, with no mass and a wrong scaled value (`2 cup 5 tbsp`).
  - A quantity hidden behind words, such as `@flour{about 200g}`, which had no mass and vanished from a scaled recipe.
  - A number that only describes the unit, as in `{1 tin of 400 g}`, and words with no number, such as `{a pinch}`, raise nothing.
