---
"@gram-lang/parser": patch
"@gram-lang/kitchen": patch
"@gram-lang/renderer": patch
---

Composite ingredients (`@child<@parent`) gain a bare single-word child form and an independent preparation slot on the parent side, and section ingredient lists stop silently dropping the parent link the shopping list already displayed correctly.

**Added:**
- The composite operator now accepts a bare, single-word child with no `{quantity}` braces (e.g. `@juice<@lemon{1/2}`), matching the same "quantity is optional for a single-word name" rule every other `@ingredient` already follows. It previously required the child to carry `{}` (`@juice{}<@lemon`), an arbitrary exception baked into the grammar.
- The composite operator's **parent** side can now carry its own `()` preparation, independent of the child's — e.g. `@juice{150ml}<@lemon{1}(cut in half)`. Previously this was silently left as trailing plain text in the step instead of being parsed at all. `CompositeAST`/`Usage.composite` gain a `preparation?: string | null` field alongside the existing `parent`/`quantity`.

**Fixed:**
- The shopping list showed a bogus `(0)` quantity for an unmeasured bare composite child (e.g. `@juice<@lemon{1/2}`, no quantity of its own) instead of leaving it unmeasured like any other bare ingredient.
- Section/mise-en-place ingredient lists silently dropped the composite-parent link that the shopping list already displayed correctly — a `jus` child gave no indication it meant "jus de citron". They now show `jus (citron)`, and `jus (citron, coupé en deux)` when the parent also has its own preparation. Shopping-list and inline step-text rendering are unchanged; the parent's preparation, like the child's, never appears in the shopping list.

Documentation (`composite-ingredients.md`, `ai-generation-notes.md` — English and French) is updated to match, including correcting the composite guidance to attach a preparation to whichever side (child or parent) it actually describes.
