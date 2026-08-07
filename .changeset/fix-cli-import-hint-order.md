---
"@gram-lang/cli": patch
---

Fixed `gram import`'s post-write hint suggesting `gram check` as the immediate next step. A freshly imported recipe's ingredients are, by definition, not yet in the user's database, so `gram check`'s database check would flag every single one of them as missing — noise, not a real problem. The hint now points to `gram db sync` first (which is what the documented `sync → lint → enrich` workflow already recommends), then `gram check`.
