---
"@gram/parser": patch
---

Fixed an issue in the parser where ingredient references without braces (e.g., `&curd`) would incorrectly consume subsequent references on the same line, resulting in undefined reference errors.
