---
"@gram-lang/cli": minor
---

**CLI / Settings**: Every setting of a recipe now has a flag named after it, on every command where it changes something, with the same values and default as in the editor and the playground:

- `--step-quantities show|hide` on `gram print` and `gram export` chooses whether the quantities are written in the text of the steps (replaces `--no-step-qty`, which still works)
- `--nutrition-basis` is the new name of `--nutrition` on `gram view`, `gram print` and `gram export` (`--nutrition` still works)
- What the analyzer computes can now be turned off on `gram view`, `gram print`, `gram export`, `gram cook`, `gram build`, `gram watch` and `gram shop`: `--no-mass-standardization`, `--no-yield-calculation`, `--no-nutrition-estimation` and `--no-bakers-math`; everything stays on by default
- An unknown value stops the command and lists the values it accepts, under the name you typed
