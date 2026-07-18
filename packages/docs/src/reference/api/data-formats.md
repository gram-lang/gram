# Data Formats

The JSON shapes that flow between pipeline stages, and the YAML schema for the ingredient database. This page complements the per-package references — it's the "what does the data actually look like" companion to their "what functions exist" content.

## 1. The AST (`@gram-lang/parser`)

For this source:

```gram
---
title: 'Crepes'
---

## Batter

Mix @flour{200g} and @milk{200ml}.
```

`getAST()` returns (annotated, `loc` offsets omitted for brevity — every node except `RecipeAST` itself carries one):

```json
{
  "type": "Recipe",
  "meta": { "title": "Crepes" },
  "children": [
    {
      "type": "Section",
      "title": "Batter",
      "retroPlanning": null,
      "intermediateDecl": null,
      "children": [
        {
          "type": "Step",
          "action": null,
          "children": [
            { "type": "Text", "value": "Mix " },
            {
              "type": "Ingredient",
              "name": "flour",
              "modifiers": [],
              "alias": null,
              "preparation": null,
              "composite": null,
              "quantity": {
                "type": "Quantity",
                "value": { "type": "single", "value": 200, "text": "200" },
                "unit": "g",
                "fixed": false
              }
            },
            { "type": "Text", "value": " and " },
            {
              "type": "Ingredient",
              "name": "milk",
              "modifiers": [],
              "quantity": {
                "type": "Quantity",
                "value": { "type": "single", "value": 200, "text": "200" },
                "unit": "ml",
                "fixed": false
              }
            },
            { "type": "Text", "value": "." }
          ]
        }
      ]
    }
  ]
}
```

See [parser.md](/reference/api/parser) for the full set of node interfaces and the `ASTNodeType` enum.

## 2. Compiled & analyzed recipes (`@gram-lang/kitchen`, `@gram-lang/analyzer`)

`compile()` produces a `CompilationResult`; `analyze()` returns that same shape enriched with mass/nutrition fields (`AnalyzedCompilationResult`). Diffed below — analyzer-only fields are marked:

```json
{
  "title": "Crepes",
  "slug": "crepes",
  "meta": { "title": "Crepes" },
  "registry": {
    "ingredients": {
      "flour": { "id": "flour", "name": "flour" },
      "milk": { "id": "milk", "name": "milk" }
    },
    "cookware": {}
  },
  "shopping_list": [
    {
      "id": "flour",
      "name": "flour",
      "qty": 200,
      "unit": "g",
      "_usageIds": ["1"],

      "normalizedMass": 200,        // analyzer
      "conversionMethod": "physical", // analyzer
      "isEstimate": false,            // analyzer
      "bakersPercentage": 100          // analyzer, only if baker's math is active
    },
    {
      "id": "milk",
      "name": "milk",
      "qty": 200,
      "unit": "ml",
      "_usageIds": ["2"],

      "normalizedMass": 206,          // analyzer — converted via density if known
      "conversionMethod": "density",  // analyzer
      "isEstimate": true              // analyzer — density came from the ingredient DB, not an explicit override
    }
  ],
  "cookware": [],
  "sections": [
    {
      "title": "Batter",
      "retro_planning": null,
      "ingredients": [ "/* same Usage objects as shopping_list, enriched identically */" ],
      "cookware": [],
      "steps": [
        {
          "type": "step",
          "timings": { "start": 0, "end": 2, "activeDuration": 2 },
          "backgroundTasks": [],
          "content": [
            "Mix ",
            { "id": "flour", "_usageId": "1", "qty": 200, "unit": "g", "normalizedMass": 200 },
            " and ",
            { "id": "milk", "_usageId": "2", "qty": 200, "unit": "ml", "normalizedMass": 206 },
            "."
          ]
        }
      ],
      "metrics": {                     // analyzer, per-section
        "totalMass": 406,
        "massStatus": "estimated",
        "missingMassIngredients": []
      }
    }
  ],
  "warnings": [],
  "metrics": {
    "preparationTime": 2,
    "cookTime": 0,
    "activeTime": 0,
    "totalTime": 2,

    "totalMass": 406,                   // analyzer, global
    "massStatus": "estimated",          // analyzer
    "missingMassIngredients": [],       // analyzer
    "nutrition": {                      // analyzer, only if enableNutritionalEstimation
      "total": { "calories": 748, "protein": 27.7, "carbs": 130.4, "fat": 11.4 },
      "isEstimate": true,
      "coverage": 1
    }
  }
}
```

Note the compiler's `StepToken` vocabulary inside `content`: plain narrative text is a bare `string`; ingredients/cookware/references share the `Usage` shape (no `type` field, identified by having an `id`); timers/temperatures/comments/declarations each carry their own lowercase `type`. This is intentionally distinct from the parser's PascalCase `ASTNodeType` — it describes compiled *output*, not parsed input. See [How to Build a Custom UI](/how-to/build-custom-ui) for a walkthrough of consuming this shape in a frontend framework.

## 3. Ingredient database (YAML)

The database passed to `validateIngredientDatabase()` / `analyze()` is a flat `Record<string, IngredientData>` keyed by ingredient slug. The `gram` CLI additionally accepts (and unwraps) an optional top-level `ingredients:` key, so both of these are valid `.gram/ingredients.yaml` files:

```yaml
# With the optional wrapper (what `gram init` scaffolds)
ingredients:
  flour:
    name: "All-purpose flour"
    aliases: ["farine"]
    category: "Grains"
    physical:
      density: 0.59       # g/mL — bridges volume units ("1 cup") to mass
      yield: 1.0           # fraction (0, 1] — net/gross ratio after prep waste
      unit_weight: 120     # grams per "unit" (e.g. "1 flour" if ever used bare)
    nutrition:             # all values per 100 g
      calories: 364
      protein: 10.3
      carbs: 76.3
      fat: 1.0
      sugar: 0.3
      fiber: 2.7
      sodium: 2

# Flat form (what validateIngredientDatabase()/analyze() expect directly)
flour:
  name: "All-purpose flour"
  physical:
    density: 0.59
```

`physical` and `nutrition` are both optional — an entry with neither is still valid (it just contributes no mass/nutrition data, surfacing as `missingMassIngredients` / a `MISSING_MACROS` warning). Only `name` is required. `nutrition.calories`/`protein`/`carbs`/`fat` are required whenever `nutrition` is present; `sugar`/`fiber`/`sodium`/`sat_fat`/`mono_fat`/`poly_fat`/`alcohol` are all optional.
