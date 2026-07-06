---
"@gram-lang/kitchen": patch
"@gram-lang/analyzer": patch
"@gram-lang/renderer": patch
---

Fix `_usageId` leaking a global counter across separate `compile()` calls in the same
process (affected the language server and `gram scale`'s parallel compiles, making ids
non-deterministic for an unchanged recipe). Fix nutrition analysis always reporting
`isEstimate: true` regardless of actual data precision. Fix the section mass badge in
HTML output missing its scale icon.