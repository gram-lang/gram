---
"@gram-lang/kitchen": patch
---

Fix total recipe time calculation when using background timers

Previously, the compiler did not wait for passive tasks (like resting dough in the fridge) to finish before letting you use the result. This caused the estimated "Total Time" to be unrealistically short. The engine now properly understands dependencies and waits for intermediate preparations to be fully ready before proceeding to steps that need them.
