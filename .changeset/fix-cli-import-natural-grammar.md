---
"@gram-lang/cli": patch
---

Fixed `gram import` dropping articles in non-English output (e.g. French "Assaisonner @poulet{4}..." instead of "Assaisonner les @poulet{4}..."). The prompt's reference example is written in English, where articles aren't needed before a direct object — the AI was copying that as if it were a Gram syntax rule rather than an artifact of English grammar. The prompt now explicitly says to write full, grammatically natural sentences around `@`/`#`-tokens in the target language, with a concrete example.
