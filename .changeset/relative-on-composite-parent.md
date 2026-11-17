---
"@gram-lang/kitchen": patch
---

**Kitchen**: A percentage on a composite parent (`@eggs{3}<@box{50% @&flour}>`) no longer vanishes without a word: it raises an `INVALID_QUANTITY` warning (`reason: "relativeNotSupported"`), shown in the editor, and the parent is read with no quantity until composites support it.
