---
"@gram-lang/parser": patch
"@gram-lang/cli": patch
---

Fix two bare-name (no-`{}`) parsing bugs, both affecting `@ingredient`, `#cookware`, `&reference`, and `<@parent` names written without braces.

**Fixed:**
- A trailing sentence period (`.`) was being silently absorbed into a bare name instead of staying as ordinary text — `Add the @salt.` produced an ingredient literally named `"salt."`, breaking shopping-list aggregation with any other mention of the same ingredient, i18n/ingredient-database lookups, and rendering. `sentencePunct` now includes `.` alongside the already-excluded `,` `;` `!` `?`.
- An unbraced multi-word name before `|` in an alternative (`@egg substitute|@tofu`) was silently mis-parsed — the first word became a standalone ingredient, the rest of the name plus the `|` itself became literal step text, and the second option became an unrelated standalone ingredient, silently destroying the intended alternative group. A `|` that isn't consumed by a valid `@a|@b`/`#a|#b` alternative is now a clear `GramParseError` explaining the likely cause (a multi-word name missing `{}`), instead of a silent, hard-to-notice corruption. This applies to both ingredient and cookware alternatives.

**Note:** as a result of the second fix, any orphan `|` in step prose — even unrelated to an ingredient/cookware alternative — is now a parse error, since `|` has no other legitimate meaning in the grammar.

A standalone multi-word name without `{}` and without `|` (e.g. `@egg substitute and mix`, no alternative involved) is unchanged — there is no reliable syntactic way to tell a continued name apart from ordinary prose that happens to follow, so this remains a documentation-only concern: `ai-generation-notes.md` (EN+FR) and the `gram import` system prompt (`packages/cli/src/prompts/gram-spec.ts`) now both explicitly call out that a multi-word name always needs `{}`, even an empty one.
