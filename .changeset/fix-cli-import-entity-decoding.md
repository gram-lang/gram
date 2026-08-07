---
"@gram-lang/cli": patch
---

Fixed `gram import`'s HTML entity cleanup only handling a hand-picked list of named entities (`&amp;`, `&nbsp;`...), missing the numeric character references (`&#233;`, `&#x2019;`...) that real recipe sites most commonly use to encode accented characters and typographic punctuation — especially relevant for non-English content. These are now decoded generically instead of one at a time, including double-encoded cases like `&amp;#39;`, with a guard against malformed references crashing the import.
