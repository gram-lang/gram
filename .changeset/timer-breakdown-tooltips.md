---
"@gram-lang/kitchen": patch
"@gram-lang/renderer": patch
"@gram-lang/analyzer": patch
"@gram-lang/i18n": patch
---

Add per-contribution time breakdowns (`activeBreakdown`, `prepBreakdown`, `totalBreakdown`) to compiled recipe metrics, and surface them as explanatory tooltips on the Active/Prep/Total time badges and summary card in the HTML renderer.

The critical-path computation for `totalBreakdown` now sorts contributions by start time before computing the greedy interval union, instead of merging them in source order — named background timer tracks can serialize a timer's effective start well after its position in the recipe source, which could previously cause an earlier, unrelated contribution to be undercounted. Breakdown entries are merged through a shared `addToBreakdown` helper (`@gram-lang/kitchen`) to keep `metrics.ts` and `processor.ts` consistent, and label ids (e.g. `prep_<id>`) are resolved to the recipe's own ingredient/cookware wording via the registry at render time, matching the existing shopping-list/section-list convention rather than showing raw slugs.
