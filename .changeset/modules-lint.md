---
"@gram-lang/modules": minor
"@gram-lang/language-server": minor
---

**Language Server**: The editor's diagnostics now come from a shared, documented lint layer, and a project can tune them:
  - New experimental entry point `@gram-lang/modules/lint`: `lintDocument()` returns every diagnostic of a recipe (the compiler's warnings and the editor's own checks) with its severity, documentation link and fixes, `allDiagnosticInfo()` lists every code, and `parseLintConfig()` reads the project settings. Its shape may still change in a minor release.
  - Every diagnostic links to its own section of the warnings reference, which now documents all codes, the module codes and the editor's own included; a syntax error now carries the code `PARSE_ERROR`.
  - `.gram/config.yaml` can turn a check off or change its severity (`lint: { rules: { UNKNOWN_INGREDIENT: off } }`), and a `// gram-ignore CODE` line silences a code for the step or section heading right below it; an error is never silenced.
  - The spelling fix of an unknown ingredient is no longer the preferred fix, so an editor's auto fix never applies it: renaming an ingredient changes the recipe.
