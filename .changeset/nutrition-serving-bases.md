---
"@gram-lang/analyzer": minor
"@gram-lang/renderer": minor
"@gram-lang/i18n": minor
"@gram-lang/cli": minor
---

Nutrition can now be shown per portion and per 100 g, not just for the whole recipe.

The `portions:` you write in a recipe is finally used. It was documented as dividing the nutrition into per-portion figures, but nothing read it — so `gram view` showed no nutrition panel at all for a recipe that declared portions, and the per-portion numbers you did occasionally see were divided by the `--scale` factor instead. If you scale a recipe, per-portion values now stay the same, which is what you'd expect.

There is also a new **per 100 g** basis, which needs no `portions` at all — so a recipe that never declared one still gets a standardized figure to compare against a product label.

- `--nutrition <auto|total|per-portion|per-100g>` on `gram view`, `gram export` and `gram print` picks which basis to show. The default keeps what you see today: per portion when the recipe declares portions, otherwise the whole recipe.
- In the playground and the VS Code preview, you can switch between the three bases directly in the nutrition panel.
- Nutrient labels are now translated. A recipe rendered in French used to show a French heading over English rows.

One caveat, stated on the page rather than hidden: Gram doesn't model cooking loss, so "per 100 g" means per 100 g of the raw assembled mixture. The panel tells you which weight it divided by, and flags it when that weight is only an estimate or a lower bound.
