---
"@gram-lang/parser": patch
---
**Fix: Allow preparations on bare ingredients and cookware**
Previously, the parser and the TextMate syntax highlighter required quantity braces `{}` to attach a preparation to an element (e.g. `@butter{}(melted)` or `#pan{}(20cm)`). 
The grammar has been updated to support attaching preparations directly to bare elements without braces. You can now write `@butter(melted)` or `#pan(20cm)` naturally. The AST will correctly extract the `preparation` property, and your editor will highlight it properly.