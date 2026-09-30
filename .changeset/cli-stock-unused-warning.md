---
"@gram-lang/cli": patch
---

**CLI / Stock**: `gram view`, `gram cook`, `gram check`, `gram scale`, `gram export` and `gram print` now warn on stderr when a `--stock` entry matches none of the recipe's `@use`, as `gram build` and `gram shop` already did, instead of ignoring it silently — most often a relative path typed from another directory, since it is resolved from the current directory
