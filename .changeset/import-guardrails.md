---
"@gram-lang/cli": minor
---

`gram import` now refuses to hand you a recipe that came back broken.

Until now, whatever the AI returned was written out. If it lost half a step, or if its two repair attempts failed, you got a file and a clean exit code — and no way to know without opening it. Three things changed.

**Lost ingredients are detected.** Every `@ingredient` written into the file is matched against what the compiler actually saw. When they disagree, text was swallowed. The usual culprit is a `//` comment dropped in the middle of a sentence: `//` comments to the end of the line, so everything after it disappears — and the file still compiles, with no warning, simply missing ingredients. This really happened, twice, losing four ingredients in one recipe and three in another.

**Errors the AI never fixed are reported.** The repair loop used to run out of attempts and write the file anyway.

In both cases nothing is written now. You get the list of what went wrong, and can re-run with a different `--model`, or with `--force` to take the file as-is.

**Invented sources and authors are gone.** The AI was filling in `source:` and `author:` when the recipe had neither, usually with `https://example.com/…` copied from an example. Those fields now come from the source data, or are left out.

Where an ingredient database is available, the import also tells you which ingredients it doesn't know yet and which quantities it couldn't weigh. That's information about your database rather than a problem with the import, so it never blocks.

**And `gram import recipe.json > recipe.gram` now works.** Redirecting the output used to capture the progress spinner into the file along with the recipe. Progress messages go to the error stream now, leaving the recipe alone.
