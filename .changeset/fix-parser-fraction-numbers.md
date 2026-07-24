---
"@gram-lang/parser": patch
---

Fixed two silent quantity-corruption bugs in fraction parsing: a decimal numerator (e.g. `1.5/2`) used to be truncated to an integer before dividing, silently turning `1.5/2` into `0.5` instead of `0.75`; a zero denominator (e.g. `1/0`) used to produce `Infinity`, which serializes to `null` in JSON, instead of being rejected outright.
