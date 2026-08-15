---
"@gram-lang/cli": major
---

`gram db enrich` now walks you through an interactive review before writing anything to `ingredients.yaml`, instead of writing AI-generated data straight away.

**New:**

- For each ingredient, you can accept the AI's density/unit weight/nutrition estimate, edit it, or skip it — `category`/`tags` stay low-stakes and continue to be filled in automatically, since only density and nutrition are product-specific enough to need your judgment (a French AOP butter isn't the same density as a US one). A "accept all remaining" option is available mid-review, and pressing Ctrl+C stops the review without writing anything for ingredients you haven't seen yet.
- The review now previews the AI's full proposal (density, unit weight, and every nutrition field it returned) before you decide, not just a one-line calorie count, so you can actually judge what you're accepting.
- Values you accept without editing are now tagged `# [LLM]` in `ingredients.yaml`, so unreviewed AI estimates stay identifiable later. A value you enter or edit yourself is never tagged.
- New `--yes`/`-y` flag skips the review and accepts every AI estimate automatically, for scripting.
- New `--report`/`-r` flag previews which ingredients need review without writing anything, mirroring `gram db lint --report`.
- Running in a non-interactive context (no TTY) without `--yes` now prints a warning and falls back to accepting everything automatically, so existing scripts and CI usage keep working unchanged.

**Breaking:**

- The `--dry-run`/`-n` flag has been removed in favor of `--report`/`-r`, matching `gram db lint`'s naming. Update any script using `gram db enrich --dry-run` to use `gram db enrich --report` instead — same behavior, new name.
