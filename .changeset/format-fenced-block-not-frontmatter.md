---
"@gram-lang/format": patch
---

**Format**: A block between two `---` lines that the parser reads as a step, because it holds something other than `key: value` lines (a `/* comment */`, an `@ingredient`), is now formatted like the rest of the recipe. It used to be handled as frontmatter: a trailing blank was stripped inside its comment, which changed the recipe.
