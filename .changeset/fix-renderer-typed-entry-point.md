---
"@gram-lang/renderer": patch
---

`toHTML`, `toMarkdown`, and `toPrintHTML` now type their `data` parameter instead of accepting `any`. Typing it surfaced two real bugs, now fixed: the HTML nutrition panel's "incomplete data" warning was never actually shown (it read a field that never existed, always showing a blank 0-calorie panel instead), and the printable/PDF view displayed sodium in grams instead of milligrams (1000x too high).
