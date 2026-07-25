---
"@gram-lang/parser": patch
---

Fixed a major parsing bug where a bare `@ingredient` or `#cookware` mention (one written without its own `{}`) would silently swallow an unrelated timer, temperature, cookware, or ingredient that appeared later on the same line into its own name, if that later element happened to close with a valid quantity — losing that element from the recipe entirely. For example, `Brown the @&chicken for ~{3min}.` used to lose the timer completely, turning it into a single ingredient named "chicken for ~". Both the ingredient and cookware name now stop at the same sigils (`@`, `#`, `~`, `^`, `&`) that a bare reference (`&name`) already correctly stopped at.
