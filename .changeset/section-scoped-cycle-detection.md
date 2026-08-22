---
"@gram-lang/kitchen": patch
---

Fixed a false "circular reference" warning that could appear when two different sections of the same recipe each used a percentage-of formula (`@water{70% @&flour}`) on same-named ingredients. Each section resolves its formulas independently, but the compiler was checking for cycles across the whole recipe at once, so two sections that were each perfectly fine could look like a cycle when read together. Cycle detection now stays within each section, matching how the formulas themselves are actually resolved.
