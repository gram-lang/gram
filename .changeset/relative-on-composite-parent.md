---
"@gram-lang/kitchen": patch
---

**Kitchen**: Percentages on composite parents (`@eggs{3}<@box{50% @&flour}>`) now raise `INVALID_QUANTITY` (`reason: "relativeNotSupported"`) instead of being silently dropped.
