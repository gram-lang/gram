---
"@gram-lang/cli": patch
---

**CLI**: `gram print` no longer crashes when the system has no way to open a browser (no `xdg-open` on Linux): it now says it could not open it and gives the path of the file to open by hand, as intended.
