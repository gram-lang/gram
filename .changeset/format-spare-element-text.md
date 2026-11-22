---
"@gram-lang/format": patch
---

**Formatter**: `gram format` and format-on-save no longer change text that the compiler keeps as written, so a formatted recipe always says the same thing as the original:
  - Trailing zeros and the space before `°` are only removed from numbers the parser reads. A unit written as text (`@e{%1.0}`) and a temperature or duration written as free text (`^{160 °C/320 °F}`) stay as written.
  - Tabs and trailing blanks inside an element are kept: an ingredient, reference or cookware name, a preparation, a step's `[action]`, a target state, a section title, an intermediate's name and a comment. Before, a tab in an ingredient's name turned it into another ingredient once formatted.
  - Blank lines inside a `/* … */` comment are kept as written.
