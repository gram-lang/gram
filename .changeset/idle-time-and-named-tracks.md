---
"@gram-lang/kitchen": minor
"@gram-lang/cli": minor
"@gram-lang/analyzer": patch
"@gram-lang/i18n": patch
"@gram-lang/language-server": patch
"@gram-lang/renderer": patch
---

Introduce named tracks for passive timers to automatically sequence them

Passive timers (`~_`) that share the same name (e.g. `~_cuisson{10m}` and `~_cuisson{30m}`) will now automatically sequence one after another on the same background track, accurately increasing the wait time without impacting the cook's active time.

Additionally, the internal metric `cookTime` has been renamed to `idleTime` across all packages to accurately reflect its semantic meaning (hands-off wait time) and avoid confusion with active cooking time.
