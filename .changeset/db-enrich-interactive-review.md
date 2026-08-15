---
"@gram-lang/cli": minor
---

`gram db enrich` now walks you through an interactive review before writing anything to `ingredients.yaml`, instead of writing AI-generated data straight away.

**New:**

- For each ingredient, you can accept the AI's density/unit weight/nutrition estimate, edit it, or skip it — `category`/`tags` stay low-stakes and continue to be filled in automatically, since only density and nutrition are product-specific enough to need your judgment (a French AOP butter isn't the same density as a US one). A "accept all remaining" option is available mid-review, and pressing Ctrl+C stops the review without writing anything for ingredients you haven't seen yet.
- Values you accept without editing are now tagged `# [LLM]` in `ingredients.yaml`, so unreviewed AI estimates stay identifiable later. A value you enter or edit yourself is never tagged.
- New `--yes`/`-y` flag skips the review and accepts every AI estimate automatically, for scripting.
- New `--report`/`-r` flag previews which ingredients need review without writing anything, mirroring `gram db lint --report`.
- Running in a non-interactive context (no TTY) without `--yes` now prints a warning and falls back to accepting everything automatically, so existing scripts and CI usage keep working unchanged.

**Changed:**

- `--dry-run`/`-n` is now a pure preview mode (same as `--report`), listing what needs review without deciding or writing anything. It's kept working as a synonym of `--report`, not removed, so existing usage of the flag doesn't break — but it no longer previews "what would be written if everything were accepted", since nothing is decided until you review it.
