---
"@gram-lang/language-server": patch
---

**Language Server**: The "declared but never used" warning on an intermediate (`->&dough`) no longer fires when the intermediate is in fact used:
  - An intermediate named as the target of a share, a ratio or a proportional timer (`@salt{2% &dough}`, `@salt{2 g / 100 g &dough}`, `~{15 min / 500 g &dough}`) now counts as used.
  - An intermediate declared on a section heading (`## Dough ->&dough`) is never flagged: it is what a base recipe exports to the recipes that import it, or the name of the finished dish. Only an unused intermediate declared at the end of a step is still reported.
