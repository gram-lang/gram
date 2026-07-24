---
"@gram-lang/analyzer": patch
---

A relative-quantity ingredient's resolved quantity (e.g. `@water{50% @&flour}`) is now tagged with the correct `"single"` type instead of a value that didn't match any of the documented quantity shapes — it happened to still render correctly today only because of an unrelated fallback, so this is a safety fix rather than a visible change.
