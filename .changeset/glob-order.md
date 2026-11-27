---
"@gram-lang/cli": patch
---

**CLI**: The files a glob matches (`gram check`, `build`, `shop`, `format`, `suggest`, `db sync` over `**/*.gram`) are now listed sorted by path, so their reports read the same on every machine instead of following the filesystem's own order.
