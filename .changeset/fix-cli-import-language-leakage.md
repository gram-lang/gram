---
"@gram-lang/cli": patch
---

Fixed `gram import` producing ingredient, cookware, and action names still in English even when the project's configured language was something else (e.g. French). The AI prompt's one and only worked example was written in English and repeated throughout a long spec document, which drowned out the language instruction — the prompt now repeats that instruction after the example and explicitly says the example illustrates syntax only, not vocabulary to copy.
