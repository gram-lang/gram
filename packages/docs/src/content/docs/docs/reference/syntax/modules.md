---
title: "Module Imports"
description: "Import another .gram file as a reusable sub-component with @use, and how scaling, encapsulation, and the shopping list work across files."
---

A recipe can `@use` another `.gram` file as a reusable sub-component — a shortcrust pastry, a stock, a batch of egg whites — instead of copy-pasting its steps into every recipe that needs it.

```gram
---
title: 'Lemon Meringue Tart'
---

@use "./bases/pate-sablee.gram" as &pate

## Montage

[Foncer] the mold with &pate{250g}.

[Garnish] with @lemon-curd{300g}.
```

The imported recipe's steps are inlined into the timeline, exactly as if you'd pasted them in by hand: a base's resting time still interleaves with everything else happening in the recipe, and its ingredients merge onto the same shopping list as the host's own.

## Syntax

`@use` directives go right after the frontmatter, before any step — see [Document Structure](/docs/reference/syntax/document-structure#2-module-imports).

```gram
@use "./bases/pate-sablee.gram" as &pate
@use "./bases/oeufs.gram" as { &blancs, &jaunes }
@use "./bases/creme.gram" as { &creme as &creme-patissiere }
```

*   **Default binding** — `as &name` binds the module's default export to `&name`.
*   **Destructured bindings** — `as { &a, &b }` binds several of the module's exports at once. Add `as &newName` after any one of them to bind it under a different local name (`as { &a as &renamed, &b }`).
*   **Retro-planning** — an optional `~{...}` clause after the bindings (`as &levain ~{-2d}`) that anchors the imported base somewhere other than the timeline's start — see [Anchoring an import in time](#anchoring-an-import-in-time--2d) below.
*   **Multi-word names** — same as an [intermediate variable](/docs/reference/syntax/intermediate-variables), wrap a name with spaces in `{}`: `as &pate feuilletée{}`, or `{ &pate feuilletée{} as &pâte }` on either side of a destructured rename.
*   The specifier must end in `.gram`, and be one of: a relative path (`./`, `../`), the project root (`@/`), or a named `paths:` alias (`@alias/`) — see below. Only files inside your project are resolvable — an absolute path or a URL is rejected.

## Project-root and aliased paths

`./`/`../` specifiers resolve against the *importing file's own directory* — fine for a base sitting next to its recipe, awkward for one shared from three directories deep. `@/` always means the project root instead (the nearest ancestor containing `.gram/`), regardless of where the importing file lives:

```gram
@use "@/bases/pate-sablee.gram" as &pate
```

For a name shorter than a long relative path, or a base that lives outside the project root entirely (e.g. a shared directory of family recipes), declare a `paths:` alias in `.gram/config.yaml`:

```yaml
paths:
  bases: ./shared/bases
```

```gram
@use "@bases/pate-sablee.gram" as &pate
```

Each alias resolves to a directory relative to the project root, and every path it produces is still confined to the project root — an alias can't be used to reach outside your project.

## What a module exports

Only **section-level** intermediates (`->&` at the end of a `## Section` title) are visible to an importer — a step-level `->&` stays private to the file that declares it. See [Intermediate Variables](/docs/reference/syntax/intermediate-variables) for the difference between the two.

```gram
## Blancs ->&blancs

Separate @egg{100g}.

## Jaunes ->&jaunes

Separate @egg{50g}.
```

A module with exactly one `->&` exports it as the **default** — the target of the plain `as &name` form. A module with several exports, or none at all, defaults to whatever its last section produces; import it with destructuring (`as { &blancs, &jaunes }`) to reach a specific one.

A module never re-exports what it itself imports — if `sauce.gram` uses `&bouillon` from `base.gram`, importing `sauce.gram` gives you `&sauce`, not `&bouillon`. A module that wants to expose a base on purpose does so explicitly, with its own section:

```gram
@use "./base.gram" as &bouillon-base

## Bouillon ->&bouillon

[Reserve] the &bouillon-base as is.
```

## Scaling

Declare how much a module produces with the `yields:` frontmatter key, and Gram scales the whole module to match how much you actually ask for:

```gram
---
title: 'Shortcrust Pastry'
yields: 500g
---

## Pastry

Mix @flour{300g} with @butter{200g}.
```

Requesting `&pate{250g}` against this 500g base scales every quantity in it by 0.5 — no `--scale` flag needed. `yields:` also accepts a discrete count (`yields: 24 cookies`, `yields: 1 tart`).

Without a declared `yields:`, Gram measures the module's own mass to work out the scale factor, and flags the result as an estimate (`ESTIMATED_MODULE_YIELD`) whenever that measurement itself relies on an estimated density or unit weight, rather than a real mass.

**Destructured bindings scale together, per export.** Each bound export is measured against its own yield, and if you use more than one binding from the same module with different quantities, the *larger* ratio wins for the whole module (the same sum-within-an-export/max-across-exports rule Gram already uses for [composite ingredients](/docs/reference/syntax/composite-ingredients)):

```gram
@use "./bases/oeufs.gram" as { &blancs, &jaunes }

Whisk &blancs{200g} and &jaunes{50g}.
```

If `oeufs.gram` yields 100g of blancs and 50g of jaunes, `&blancs{200g}` needs the module scaled ×2 — which then produces 100g of jaunes against the 50g actually used. That surplus is real information, not an error: Gram reports it (`MODULE_SURPLUS`) rather than rejecting the import.

**Cook and rest times are never scaled** — doubling a batch of cookies doesn't halve their time in the oven. A bare count against a mass or volume yield (`&cookies{2}` against a `yields: 500g` module) is read as *batches* of the module rather than a fraction of it, and Gram says so explicitly (`MODULE_BATCH_INTERPRETATION`) since it's the one place in the pipeline where "how many times do I run this" actually matters. Past what your equipment can hold in one go, duplicate the steps by hand or use a [named track](/docs/reference/syntax/times) to serialize successive batches.

## Encapsulation

A module's own relative quantities (`@water{70% @&flour}`) and ingredient-dependency checks resolve only against *that module's own sections* — a host recipe that happens to use `@flour` for something else entirely never leaks into a base's own math, and vice versa. This is the same section-scoping rule Gram already applies within a single file; importing another file doesn't change it.

A module that's just a bare sequence of steps, with no `## heading` of its own, still gets its own section once spliced in — it never gets merged into a host's own untitled section.

## What doesn't carry over

Splicing in a module's sections doesn't merge its frontmatter into the host's. `title`, `description`, `author`, `source`, `tags`, `category`, and every other informational key are the host recipe's own — a base tagged `vegan` doesn't make an egg-and-butter tart "vegan" just because it imports that base's dough. The host's own frontmatter is always authoritative.

Two exceptions:
*   `densities:` merges in (the host's own value wins on conflict).
*   `yields:` is read to compute the scale factor, then discarded — it has no meaning once a module has been scaled and spliced into something else.

A module's own baker's-percentage reference (`*`) is dropped on import — baker's math for "tart plus imported pastry" has no coherent meaning, and Gram already only allows one `*` per document.

## Stocking an import (skip the steps)

By default, an imported module's steps are inlined into the timeline — the point of the whole feature, for a base whose own resting time or oven pass needs to interleave with everything else. Sometimes you don't want that: the base is already sitting in the pantry, bought ready-made or prepped yesterday. That's not something the recipe file itself can know — it's true of *this particular cooking session*, not of the recipe in general — so it's a flag you pass to the command, not `.gram` syntax:

```gram
@use "./bases/bouillon.gram" as &bouillon

## Soup

Simmer with &bouillon{1L}.
```

```sh
gram shop soup.gram --stock @bases/bouillon.gram
```

`--stock` takes a comma-separated list of the same specifiers `@use` accepts (`@bases/bouillon.gram`, `./bases/bouillon.gram`, …), resolved the same way. A stocked import costs zero timeline — its steps never appear in the Gantt at all — and collapses to a single purchasable line on the shopping list instead of its exploded ingredients. Its mass and nutrition still count toward the recipe's totals, sourced from the base's own real composition, so switching `--stock` on or off never changes what the recipe *is* — only how much of it you still need to make.

`--stock` is accepted by every command that resolves `@use` (`build`, `check`, `view`, `export`, `cook`, `print`, `watch`, `shop`, `scale`). It's deliberately not something the language server or the live editor preview reads — deciding "I have this on hand" is a decision you make at the moment of shopping or cooking, not while editing the recipe, so the editor always shows every import fully scheduled and inlined.

## Anchoring an import in time (`~{-2d}`)

A base that IS being made fresh sometimes still needs to start ahead of the rest of the recipe's timeline — a levain that needs two days to develop, a marinade that needs an overnight rest. Add the same `~{...}` retro-planning clause [section headers already support](/docs/reference/syntax/times#section-retro-planning) directly to the `@use` line:

```gram
@use "./bases/levain.gram" as &levain ~{-2d}

## Pain

Mix in the &levain{200g}.
```

This is the *importer's* call, not something hardcoded inside the base file — the same `levain.gram` might be anchored at `-2d` in one recipe and used same-day in another. If the base itself declares its own retro-planning on the section that produces the bound export, the `@use`-level clause wins (`RETRO_PLANNING_OVERRIDE_SHADOWED`). Combining `--stock` with `~{...}` on the same import is a contradiction — there's nothing left to schedule — and is flagged (`STOCKED_RETRO_PLANNING_IGNORED`) rather than silently accepted.

## Editor support

The language server (VS Code, or any other editor that speaks LSP) resolves `@use` while you type, not just when you run the CLI:

*   Diagnostics, the live preview, and the Gantt view all reflect the composed recipe — including an imported base's own yield-scaling. An unsaved edit in a dependency counts too, even one open in a different tab, and even a change made outside the editor entirely (a `git pull`, another tool, a save from a different window).
*   That resync propagates through the whole import chain: editing a deeply-nested base refreshes every open file that (transitively) uses it, and a problem inside it points straight at the exact file and line rather than just "something's wrong somewhere in your imports."
*   Go to Definition on `&pate` jumps into the base file itself, landing on the section that binding was actually exported from.
*   Typing `@use "` completes: `./`, `../`, `@/`, and any declared `paths:` alias as starting points, then the `.gram` files and subdirectories actually there once the path commits to one of them.

## Limits (for now)

*   There is no official, Gram-maintained library of standard base recipes, and none is planned — a community package hub (`hub:author/package` specifiers) is a long-term idea, not yet implemented.
