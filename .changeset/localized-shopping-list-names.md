---
"@gram-lang/analyzer": patch
"@gram-lang/cli": patch
"@gram-lang/renderer": patch
"@gram-lang/docs": patch
---

Fixed shopping list ingredient names defaulting to the database's canonical wording when the recipe used a valid alias. The lists now correctly preserve the recipe's original wording or translated alias, ensuring consistent language throughout.
