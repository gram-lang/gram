---
"@gram-lang/cli": minor
---

`gram db validate` and `gram db enrich` now catch more internally-inconsistent ingredient data — no external reference database involved, only arithmetic and physical sanity checks against an ingredient's own other fields.

**New `gram db validate` warnings:**

- Calories that diverge significantly from the standard Atwater estimate (4 kcal/g protein, 4 kcal/g carbs, 9 kcal/g fat, 7 kcal/g alcohol).
- Sugar exceeding total carbs, or fat sub-types (saturated + mono + poly) exceeding total fat.
- Density outside the typical range for the ingredient's category (e.g. an oil below 0.85 or above 1.0 g/mL) — a broad, category-level sanity range, not an assertion about any specific product's exact density.
- Density below a new lower bound, and an implausible `unit_weight` (too small or too large) — both were previously unchecked.

**`gram db enrich` changes:**

- The AI can no longer propose a `density` or `unit_weight` outside plausible physical bounds — previously only an upper bound on density existed.
- The AI is now given a couple of calibrated reference examples and asked to self-check that its calorie estimate is consistent with its own macros before responding, which should reduce how often the new Atwater warning above gets triggered by AI-enriched entries in the first place.
- When an ingredient's category is already known, it's now passed to the AI so it doesn't have to re-guess it while estimating density/nutrition.
