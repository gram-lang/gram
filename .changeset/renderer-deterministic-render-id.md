---
"@gram-lang/renderer": minor
---

`toHTML` no longer stamps footnote anchor ids with `Math.random()`. Output is now deterministic by default (ids like `note-1`), which is required for byte-stable golden/conformance testing. If you render multiple recipes on the same page and relied on random ids to avoid anchor collisions, pass a new `renderId` option (e.g. a recipe slug) to disambiguate.
