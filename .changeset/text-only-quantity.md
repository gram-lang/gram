---
"@gram-lang/kitchen": patch
"@gram-lang/renderer": patch
---

**Kitchen & Rendering**: Fixed a quantity written in words (`@sel{une pincée}`, `@pepper{to taste}`) disappearing: it now shows as written in the step, in the section's ingredients and in the shopping list, where the compiled entry lists it in `variable_entries`.
