---
"@gram-lang/kitchen": minor
"@gram-lang/cli": minor
---

**Parser & Kitchen**: Composite ingredients written with a short, generic child name (like `@juice<@lemon`) are now protected against a silent ingredient-database mix-up:
  - The compiler now warns when the same short composite name (e.g. "juice") is drawn from two different parents within one recipe (lemon in one step, orange in another) — until now this went unnoticed and the two usages silently shared one entry in the ingredient database.
  - `gram db sync` reports the same conflict across your whole recipe collection, so two unrelated recipes that happen to use the same generic composite name don't overwrite each other's nutrition and density data.
  - The AI recipe importer (`gram import`) now writes composite ingredients with their full name (e.g. "lemon juice") instead of a short generic one, so newly imported recipes don't create this conflict in the first place.
