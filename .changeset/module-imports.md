---
"@gram-lang/parser": minor
"@gram-lang/kitchen": minor
"@gram-lang/cli": minor
---

Recipes can now import other recipes.

```gram
@use "./bases/pate-sablee.gram" as &pate

## Montage

[Foncer] le moule avec &pate{250g}.
```

The imported recipe's steps are inlined into the timeline, so a base's resting time still interleaves with everything else the way it would if you'd copy-pasted it in by hand — the whole point of Gram's scheduling doesn't get lost just because the pâte lives in its own file now. Ingredients merge across files onto one shopping list the same way they already merge across sections.

Declare a `yields:` key in the base recipe (`yields: 500g`, `yields: 24 cookies`) and Gram scales the whole thing to match how much of it you actually ask for — `&pate{250g}` against a 500g base halves it automatically, no `--scale` flag needed. Without one, Gram measures the base's own mass to work it out, and tells you when that measurement is only an estimate.

A base with more than one usable piece can be destructured — `@use "./bases/oeufs.gram" as { &blancs, &jaunes }` — and each piece scales against its own yield, not the whole module's.

This is a first pass: imports are relative file paths only (`./`, `../`) for now — no shared library of standard bases yet, and no opt-out from inlining a base's steps into the timeline when you'd rather treat it as a black box. Both are coming in a later release.
