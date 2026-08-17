---
"@gram-lang/parser": minor
"@gram-lang/kitchen": minor
"@gram-lang/modules": minor
"@gram-lang/cli": minor
"@gram-lang/renderer": minor
"@gram-lang/i18n": minor
"@gram-lang/analyzer": minor
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

`gram shop` and `gram build` now skip a file when it's only there because another file in the same run imports it (e.g. `gram shop "**/*.gram"` no longer double-counts a base's flour once on its own and once folded into the recipe that uses it). Pass `--include-modules` to list or build it anyway.

Beyond a relative path (`./`, `../`), a base can now be imported as `@/bases/pate-sablee.gram` — always relative to the project root, regardless of where the importing file lives — or through a short alias declared once in `.gram/config.yaml`:

```yaml
paths:
  bases: ./shared/bases
```

```gram
@use "@bases/pate-sablee.gram" as &pate
```

Sometimes you don't want a base's own steps cluttering the timeline — a stock bought ready-made, or a sub-recipe you'd rather treat as a black box. Add `prepared` after the bindings and Gram imports it as a single opaque step instead: its own measured time still counts toward scheduling and its ingredients still land on the shopping list, but its internal steps never show up in the Gantt.

```gram
@use "./bases/bouillon.gram" as &bouillon prepared
```

The HTML, Markdown, and print output all credit a spliced-in section back to the base it came from — a small badge next to the section title naming the module (and noting when it was prepared separately).

`gram diff` now knows about imports too, instead of a single added `@use` line making the whole recipe look changed. A base's own sections no longer count as the host's sections shifting around; the import itself shows up as its own line when it's added, removed, re-bound to a different name, or rescaled to a different factor.

`gram watch` now follows imports too: saving a base recipe re-checks every file in the watched directory that uses it, directly or through a chain of other imports, not just the file that changed on disk.

This is still a first pass: there's no shared library of standard bases, and none is planned — a community package hub is a long-term idea, not yet built.
