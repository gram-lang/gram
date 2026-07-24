---
"@gram-lang/renderer": patch
---

Fixed an HTML injection vulnerability (XSS) in `toHTML`'s timing-card tooltips: a section title or named timer containing HTML would render unescaped in the "Active Time" / "Total Time" tooltips, exploitable via the playground or the VS Code preview. Both are now properly escaped like every other text field.
