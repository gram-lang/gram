---
"@gram/kitchen": patch
"@gram/parser": patch
---

Fixed an issue in the parser where composite ingredients without braces (e.g., `<@lemon,`) would incorrectly consume subsequent text on the same line, causing missing ingredients and breaking relative quantity resolutions.
