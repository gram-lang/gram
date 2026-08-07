---
"@gram-lang/cli": patch
---

Improved the quality and correctness of `gram import`'s generated `.gram` output:
- Ingredient, cookware, and action names no longer leak English words when importing into a non-English configured language (e.g. French) — the AI prompt's one worked example was written in English and was drowning out the language instruction.
- Non-English output no longer drops articles around `@`/`#` tokens (e.g. French "Assaisonner @poulet{4}..." instead of "Assaisonner les @poulet{4}...") — the AI was copying the reference example's English grammar as if it were part of Gram's syntax.
- Descriptive qualifiers fused into a compound ingredient name in the source recipe (e.g. "boneless skinless chicken breast") are now moved into a preparation annotation instead of producing an unwieldy ingredient name.
- Three of the prompt's own reference examples used a multi-word cookware name without the required trailing `{}`, which — per Gram's own syntax rules — silently truncates the name and leaks the rest into step text; the examples are now correct, and the prompt's review checklist calls out the rule explicitly.
- The frontmatter `language` field is now set deterministically to the actual configured target language after generation, instead of being left for the AI to infer (or skip).
- HTML entity cleanup of the source recipe text now decodes numeric character references (`&#233;`, `&#x2019;`...), not just a hand-picked list of named ones — these are how sites most often encode accented characters and typographic punctuation, which matters most for non-English content.
