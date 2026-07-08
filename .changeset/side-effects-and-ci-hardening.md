---
"@gram-lang/analyzer": patch
"@gram-lang/i18n": patch
"@gram-lang/kitchen": patch
"@gram-lang/parser": patch
"@gram-lang/renderer": patch
---

chore: declare `sideEffects: false` so bundlers can tree-shake unused exports from these packages

No package previously declared this, so third-party bundlers had to assume every module might have side effects and couldn't safely drop unused code.
