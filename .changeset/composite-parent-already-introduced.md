---
"@gram-lang/parser": patch
"@gram-lang/kitchen": patch
"@gram-lang/cli": patch
---

Fixed a shopping list that could ask you to buy the same ingredient twice.

When a recipe takes two parts from one ingredient — the zest and the juice of a lemon, say — Gram is meant to work out that you only need to buy one lemon. That worked, unless two things were true at once: the ingredient's name was more than one word, *and* the second part was written with `&` to mark the parent as already introduced:

```
@zest{1}<@unwaxed lemon{1} ... @juice{1}<@&unwaxed lemon{}
```

In that case Gram lost track of the name after the first word and treated it as a second, separate ingredient, so the shopping list said to buy two unwaxed lemons instead of one. Nothing warned you — the recipe compiled cleanly and simply gave the wrong list.

Single-word ingredient names were never affected, and neither were recipes that don't use `&` on the parent.
