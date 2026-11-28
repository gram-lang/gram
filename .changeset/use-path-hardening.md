---
"@gram-lang/modules": patch
"@gram-lang/cli": patch
"@gram-lang/language-server": patch
---

**Modules, CLI & Language server**: `@use` paths are safer and portable across Windows, macOS and Linux:
  - A path containing a backslash (`\`) is now rejected with `MODULE_SPECIFIER_INVALID` and a hint to use forward slashes `/`, instead of resolving on Windows only.
  - A path containing a null byte is rejected before it reaches the filesystem.
  - A project folder whose name starts with `..` (e.g. `..notes/base.gram`) is no longer mistaken for a path outside the project.
  - `validateSpecifier()` is now exported from `@gram-lang/modules`, so every tool checks a specifier the same way.
