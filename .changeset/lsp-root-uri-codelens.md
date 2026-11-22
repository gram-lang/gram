---
"@gram-lang/language-server": patch
---

**Language Server**: Two fixes for editors other than an up-to-date VS Code:
  - An editor that opens a folder without sending workspace folders, only its root (`rootUri`), now finds the workspace ingredient database (`.gram/ingredients.yaml`) like any other.
  - The "Preview" CodeLens at the top of a recipe now follows the editor's language ("Aperçu" in French) instead of always showing English.
