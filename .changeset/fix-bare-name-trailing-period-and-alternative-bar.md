---
"@gram-lang/parser": patch
"@gram-lang/cli": patch
---

Fixed bare ingredient names incorrectly absorbing trailing punctuation (like periods). Also fixed multi-word unbraced names breaking alternative group parsing. (An orphan `|` in step text is now correctly flagged as a parse error).
