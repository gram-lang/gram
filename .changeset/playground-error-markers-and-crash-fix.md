---
"@gram-lang/docs": minor
---

The playground now shows a red squiggly marker at the exact location of a syntax error (using `GramParseError`'s new `offset` field), in addition to the existing text error message.

Also fixed: the playground was crashing on mount in a real browser (`TypeError: editorRef.value.setErrorMarker is not a function`, and more broadly `GramOptions`/`GramWarnings`/`GramOutput`/`PlaygroundDropdown` never rendering). A prior automated lint fix had prefixed several `<script setup>` bindings with `_` and stripped/type-only'd a few component imports, without accounting for the fact that Biome's Vue support doesn't see `<template>` usage — so those bindings looked unused from its point of view. `vitepress build` didn't catch it because static-site generation never runs the client `onMounted` hooks where the crash occurred.
