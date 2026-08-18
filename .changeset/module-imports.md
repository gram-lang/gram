---
"@gram-lang/parser": minor
"@gram-lang/kitchen": minor
"@gram-lang/modules": minor
"@gram-lang/cli": minor
"@gram-lang/renderer": minor
"@gram-lang/i18n": minor
"@gram-lang/analyzer": minor
"@gram-lang/language-server": minor
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

A binding name with a space in it needs the same `{}` wrapping a multi-word intermediate already uses — `@use "./bases/pate-sablee.gram" as &pate feuilletée{}` — and that applies on either side of a destructured rename too, e.g. `{ &pate feuilletée{} as &pâte }`.

`gram shop` and `gram build` now skip a file when it's only there because another file in the same run imports it (e.g. `gram shop "**/*.gram"` no longer double-counts a base's flour once on its own and once folded into the recipe that uses it). Pass `--include-modules` to list or build it anyway.

Beyond a relative path (`./`, `../`), a base can now be imported as `@/bases/pate-sablee.gram` — always relative to the project root, regardless of where the importing file lives — or through a short alias declared once in `.gram/config.yaml`:

```yaml
paths:
  bases: ./shared/bases
```

```gram
@use "@bases/pate-sablee.gram" as &pate
```

Sometimes an ingredient a base recipe produces is already sitting in the pantry — bought ready-made, or prepped yesterday — and you don't want its steps cluttering the timeline. Pass `--stock` to `gram build`/`gram check`/`gram cook`/`gram shop` (and friends) with the specifiers you already have on hand, and Gram skips that import's steps entirely for this run: zero timeline cost, one purchasable line on the shopping list instead of the base's exploded ingredients — but its mass and nutrition still count toward the recipe's totals, sourced from the base's own real composition.

```
gram shop recipe.gram --stock @bases/pate-sablee.gram
```

This is a per-invocation flag, not something written into the recipe file or a project config file — the same base might be stocked one week and made from scratch the next, and nothing here needs to be kept in sync.

A base that IS being made fresh, but needs to start ahead of the rest of the timeline — a levain, a marinade that needs a day to rest — can be anchored with the same `~{...}` retro-planning syntax section headers already support, now also usable directly on the `@use` line:

```gram
@use "./bases/levain.gram" as &levain ~{-2d}
```

The HTML, Markdown, and print output all credit a spliced-in section back to the base it came from — a small badge next to the section title naming the module.

`gram diff` now knows about imports too, instead of a single added `@use` line making the whole recipe look changed. A base's own sections no longer count as the host's sections shifting around; the import itself shows up as its own line when it's added, removed, re-bound to a different name, or rescaled to a different factor.

`gram watch` now follows imports too: saving a base recipe re-checks every file in the watched directory that uses it, directly or through a chain of other imports, not just the file that changed on disk.

The editor (VS Code and any other client of the language server) now actually resolves `@use` while you type, instead of silently ignoring it: the live preview, the Gantt view, and diagnostics all reflect the composed recipe — including an imported base's own yield-scaling — and an unsaved edit in a dependency is picked up too, not just what's saved on disk. A bad import (missing file, unknown export, a cycle) now shows up as a real diagnostic in the editor rather than nothing at all.

That now propagates through the whole import chain, too: editing a base recipe refreshes every open file that uses it, even indirectly through another import, and even if the base was edited outside the editor entirely (a `git pull`, another tool, a save from a different window). A problem inside a deeply-imported base points you straight to the exact file and line — not just "something's wrong somewhere in your imports."

Go to Definition on `&pate` now jumps into the base file itself, landing on the exact section that binding was exported from — including a destructured `&blancs`/`&jaunes` each going to their own section, not just to the top of the file.

Typing `@use "` now completes: `./`, `../`, `@/`, and any `paths:` alias as starting points, then the `.gram` files and subdirectories actually there once the path commits to one of them.

This is still a first pass: there's no shared library of standard bases, and none is planned — a community package hub is a long-term idea, not yet built.

`@gram-lang/modules` now exports `createMemoryHost`, an in-memory `ModuleHost` for embedding Gram's module resolution somewhere with no real filesystem — a browser editor, a test harness, anywhere a `Map<string, string>` of file contents is all you've got. It's what the docs site's own Playground uses to let you edit a base and the recipe that imports it side by side, each in its own tab, without a project on disk.

**Fixed:** the recipe's whole-recipe mass/nutrition totals used to silently exclude any `->&` intermediate's mass, even outside of module imports — a step producing an intermediate that was then used later in the recipe undercounted the total. Per-section totals were never affected, only the top-level one.
