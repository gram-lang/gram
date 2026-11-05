---
"@gram-lang/language-server": minor
"gram-lang": minor
---

**Language Server / VS Code**: The editor shows the work plan of the recipe in place of the Gantt chart:

- A new `Gram: Work Plan` command opens it next to the recipe, in days before the service (D-2, D-1, day D); it follows the `gram.miseEnPlace` and `gram.rests` settings, and the language server sends it in a new `gram/runSheetUpdated` notification

**Deprecated**

- VS Code: the `Gram: Gantt Chart` command, removed in 2.0.0. It still works and opens the work plan, with a notice once. Use `Gram: Work Plan`
- Language server: the `gram/ganttUpdated` notification, removed in 2.0.0. It is still sent, and the VS Code extension no longer reads it. Read `gram/runSheetUpdated`, or the data of the compiled recipe
