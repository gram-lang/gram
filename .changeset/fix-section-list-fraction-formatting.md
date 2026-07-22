---
"@gram-lang/renderer": patch
---

Fixed an issue where scaled fractions resulting in values below 1 (e.g., `0.5`) were rendered as raw decimals instead of common fractions (e.g., `1/2`) in the section ingredient list.
