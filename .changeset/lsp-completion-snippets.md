---
"@gram-lang/language-server": patch
---

**Language server**: Completing a multi-word ingredient or reference name (`@wheat flour{}`, `&pizza dough{}`) now places the cursor between the braces, ready for the quantity, in editors that support snippet completions (VS Code, Neovim, Helix, Sublime Text); other editors keep inserting the braces as plain text.
