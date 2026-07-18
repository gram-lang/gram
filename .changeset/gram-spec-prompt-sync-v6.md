---
"@gram-lang/cli": patch
---

fix: synchronize the AI import gram-spec prompt (v6) with the current language and docs

- Renamed frontmatter field `size` → `makes` (matching the renamed field), and fixed the `densities` example to the actual flat-array syntax (`[flour:0.55, water:1.0]`) instead of an invalid nested YAML block.
- Documented the strict section retro-planning rule: durations must be signed-negative, non-zero, with an explicit `d`/`h`/`min` unit — free text, unsigned, zero, and `s` are all rejected.
- Renamed "sync/async" timer terminology to "active/passive" to match the current docs.
- Clarified that `@&ingredient` relative-quantity targets are section-scoped while `&variable` (intermediate) targets are resolved globally.
- Added guidance on: canonical (non-localized) unit tokens in AI-generated output, single-use-only baker's percentage reference, alias re-reference by real name, and the composite SUM rule alongside the existing MAX rule.
- Fixed a stale `docs/syntax_details/` reference in the file header.
