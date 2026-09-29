---
"@gram-lang/modules": patch
---

**Modules**: Fixed a misleading error message: a syntax error in the recipe you are editing was reported as coming from an "imported module", even when the recipe imports nothing. It now shows the plain syntax error, and the "imported module" wording is kept only for errors that really are in an imported file.
