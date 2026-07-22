---
"@gram-lang/kitchen": minor
"@gram-lang/cli": minor
"@gram-lang/analyzer": patch
"@gram-lang/i18n": patch
"@gram-lang/language-server": patch
"@gram-lang/renderer": patch
---

Renamed the `cookTime` metric to `idleTime` across the ecosystem to better reflect hands-off wait time. Additionally, passive timers sharing the same name are now automatically sequenced one after another on the same background track.
