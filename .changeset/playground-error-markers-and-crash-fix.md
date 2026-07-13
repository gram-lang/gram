---
"@gram-lang/docs": minor
---

The playground now shows a red squiggly marker at the exact location of a syntax error using the new `offset` field.

Fixed a crash in the playground on mount in real browsers caused by an aggressive automated lint fix that removed necessary Vue `<template>` bindings and component imports.
