---
"@gram-lang/parser": patch
"gram-lang": patch
---

**Parser & VS Code**: The TextMate grammar now colors a temperature's name (`oven` in `^oven{180°C}`) like a timer's name instead of like a number, as the language server already does: the name is a label for the heat source, not a value.
