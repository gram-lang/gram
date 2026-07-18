---
"@gram-lang/kitchen": patch
"@gram-lang/cli": patch
---

Fix section/mise-en-place ingredient lists showing the ingredient's slug id instead of its display name (e.g. "oeufs" instead of "œufs"), in HTML/Markdown/print export and the `gram cook` terminal UI. The shopping list already showed the correct name.

`aggregateSectionIngredients()` synthesized a fallback `name: ing.id` for every ordinary ingredient, since `Usage.name` is never populated by the compiler for regular `@ingredient` usages — only the registry (keyed by id) holds the recipe's own wording. Once the renderer started preferring an item's own `.name` over a registry lookup (to keep shopping-list names in the recipe's own wording), that synthetic id-as-name started winning over the correct registry name everywhere `aggregateSectionIngredients()` was used. The aggregator now leaves `name` unset when the source `Usage` has none, letting each consumer's own registry-lookup fallback (already correct in the renderer and already correct in `gram cook`'s step text) supply the real name.
