---
"@gram-lang/analyzer": patch
"@gram-lang/cli": patch
"@gram-lang/renderer": patch
"@gram-lang/docs": patch
---

fix: shopping list ingredient names no longer default to the ingredient database's own wording when the recipe used an alias

Shopping-list aggregation (`aggregateShoppingList`) rewrote every ingredient's `id` to a canonical database key for grouping (e.g. `beurre` -> `butter`), and the ingredient's *display* name followed the same substitution. Any time a recipe used a word the database only recognized as an **alias** — a translation (`farine`, `harina` -> `flour`), a regional synonym, a plural, whatever `ingredients.yaml`'s own `aliases` list was set up to catch — the shopping list silently showed the database's own wording instead, even though the rest of the output (recipe steps, JSON) stayed correctly worded. This wasn't specific to any language pair: it happened whenever the recipe's wording and the database's canonical wording simply weren't the same word.

The display name is now resolved by a single rule, computed once in `aggregateShoppingList` and trusted identically everywhere (the Playground, `gram export`, and the CLI's `gram view`/`gram cook`/`gram shop`):
- If the recipe already used the database's exact canonical word (e.g. `@flour` matching a `flour` key), the database's `name` is treated as a same-word enrichment and preferred — this is what lets a terse `@flour` show up as "Wheat Flour" in the shopping list.
- If the recipe used an alias instead (e.g. `@farine` or `@harina`, both resolved to `flour` through `ingredients.yaml`'s alias list), the database's name is different wording, so the recipe's own is always kept — whatever language or vocabulary it's in.
- If there's no matching database entry at all — or no database is supplied at all (`@gram-lang/kitchen`'s `compile()` used on its own, or a CLI command run without `--db`) — there's nothing to substitute, so the recipe's own wording is used as-is.

`@gram-lang/cli`'s `viewer`/`shopper` services no longer duplicate their own, differently-prioritized name resolution — they now trust the name `@gram-lang/analyzer` already resolved.

Documentation (EN/FR) has been updated to describe this rule with examples spanning several languages, and to clarify that it's unrelated to the recipe-level `@Real Name:Display Name` alias syntax, which only affects inline step display and never shopping-list grouping.
