---
"@gram-lang/parser": patch
"@gram-lang/kitchen": patch
"@gram-lang/renderer": patch
---

Added support for bare single-word children in composite ingredients (e.g., `@juice<@lemon`), and allowed independent preparation instructions on the parent side. Fixed section ingredient lists silently dropping the parent reference.
