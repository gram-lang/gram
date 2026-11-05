---
"@gram-lang/language-server": minor
"gram-lang": minor
---

**Language Server / VS Code**: The editor shows the work plan of the recipe in place of the Gantt chart:

- A new `Gram: Work Plan` command opens it next to the recipe, in days before the service (D-2, D-1, day D); it follows the `gram.miseEnPlace`, `gram.rests` and `gram.comments` settings

**Deprecated**

- VS Code: the `Gram: Gantt Chart` command, removed in 2.0.0. It still works and opens the work plan, with a notice once. Use `Gram: Work Plan`
- Language server: the `gram/ganttUpdated` notification, removed in 2.0.0. It is still sent to clients that do not declare the views protocol, and the VS Code extension no longer reads it. Read `gram/viewUpdated` with the `workPlan` output, or the data of the compiled recipe
