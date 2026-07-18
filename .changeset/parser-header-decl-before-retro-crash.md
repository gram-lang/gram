---
"@gram-lang/parser": patch
---

fix: `getAST` no longer throws `TypeError: r.toAST is not a function` when a section header writes `->&name` before `~{...}` (e.g. `## Dough ->&dough ~{-2h}`) — `headerExtension_decl`'s semantic action was calling `.toAST()` a second time on an already-converted node. The reverse order (`~{...}` before `->&name`) was unaffected; this combination simply had no test coverage before, so the bug went unnoticed.
