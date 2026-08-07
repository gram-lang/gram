---
title: "Formats de données"
description: "Référence des formes JSON de l'AST, des recettes compilées et analysées, ainsi que du schéma YAML de la base d'ingrédients."
---

Voici les structures JSON qui transitent entre les étapes du *pipeline*, ainsi que le schéma YAML de la base de données d'ingrédients. Cette page vient en renfort des références de *packages* : c'est le pendant « à quoi ressemblent concrètement les données » de la documentation orientée fonctions.

## 1. L'AST (`@gram-lang/parser`)

Pour le code source suivant :

```gram
---
title: 'Crêpes'
---

## Pâte

Mélanger @farine{200g} et @lait{200ml}.
```

`getAST()` retourne l'objet suivant (annoté, avec les offsets `loc` omis pour la lisibilité — notez que chaque nœud, hormis `RecipeAST` lui-même, en possède un) :

```json
{
  "type": "Recipe",
  "meta": { "title": "Crêpes" },
  "children": [
    {
      "type": "Section",
      "title": "Pâte",
      "retroPlanning": null,
      "intermediateDecl": null,
      "children": [
        {
          "type": "Step",
          "action": null,
          "children": [
            { "type": "Text", "value": "Mélanger " },
            {
              "type": "Ingredient",
              "name": "farine",
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
            { "type": "Text", "value": " et " },
            {
              "type": "Ingredient",
              "name": "lait",
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

Consultez [parser.md](/fr/docs/reference/api/parser) pour l'ensemble exhaustif des interfaces de nœuds et l'énumération `ASTNodeType`.

## 2. Recettes compilées & analysées (`@gram-lang/kitchen`, `@gram-lang/analyzer`)

`compile()` produit un `CompilationResult` ; `analyze()` renvoie cette même structure enrichie des champs de masse/nutrition (`AnalyzedCompilationResult`). Voici le diff (les champs injectés par l'Analyseur sont commentés) :

```json
{
  "title": "Crêpes",
  "slug": "crepes",
  "meta": { "title": "Crêpes" },
  "registry": {
    "ingredients": {
      "farine": { "id": "farine", "name": "farine" },
      "lait": { "id": "lait", "name": "lait" }
    },
    "cookware": {}
  },
  "shopping_list": [
    {
      "id": "farine",
      "name": "farine",
      "qty": 200,
      "unit": "g",
      "_usageIds": ["1"],

      "normalizedMass": 200,        // analyzer
      "conversionMethod": "physical", // analyzer
      "isEstimate": false,            // analyzer
      "bakersPercentage": 100          // analyzer, uniquement si le mode boulanger est actif
    },
    {
      "id": "lait",
      "name": "lait",
      "qty": 200,
      "unit": "ml",
      "_usageIds": ["2"],

      "normalizedMass": 206,          // analyzer — converti via la densité si connue
      "conversionMethod": "density",  // analyzer
      "isEstimate": true              // analyzer — la densité vient de la base d'ingrédients, pas d'un override explicite
    }
  ],
  "cookware": [],
  "sections": [
    {
      "title": "Pâte",
      "retro_planning": null,
      "ingredients": [ "/* mêmes objets Usage que shopping_list, enrichis à l'identique */" ],
      "cookware": [],
      "steps": [
        {
          "type": "step",
          "timings": { "start": 0, "end": 2, "activeDuration": 2 },
          "backgroundTasks": [],
          "content": [
            "Mélanger ",
            { "id": "farine", "_usageId": "1", "qty": 200, "unit": "g", "normalizedMass": 200 },
            " et ",
            { "id": "lait", "_usageId": "2", "qty": 200, "unit": "ml", "normalizedMass": 206 },
            "."
          ]
        }
      ],
      "metrics": {                     // analyzer, par section
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
    "nutrition": {                      // analyzer, uniquement si enableNutritionalEstimation
      "total": { "calories": 748, "protein": 27.7, "carbs": 130.4, "fat": 11.4 },
      "isEstimate": true,
      "coverage": 1
    }
  }
}
```

Remarquez le vocabulaire `StepToken` généré par le compilateur au sein de `content` : le texte narratif pur est une simple `string` ; les ingrédients, le matériel et les références partagent la forme `Usage` (ils n'ont pas de champ `type` et sont identifiés par la présence d'un `id`) ; les minuteurs, températures, commentaires et déclarations portent chacun un `type` explicite en minuscules. Cette distinction avec le `ASTNodeType` (en PascalCase) du *parser* est volontaire : on décrit ici la *sortie* compilée, non l'entrée. Consultez [Créer une UI personnalisée](/fr/docs/how-to/build-custom-ui) pour un tutoriel d'intégration de ces données dans un framework front-end.

## 3. Base de données d'ingrédients (YAML)

La base de données passée à `validateIngredientDatabase()` ou `analyze()` est un dictionnaire plat `Record<string, IngredientData>`, indexé par *slug* d'ingrédient. Le CLI `gram` tolère également (et aplatit) une clé racine optionnelle `ingredients:`. Les deux formats suivants pour `.gram/ingredients.yaml` sont donc valides :

```yaml
# Avec le wrapper optionnel (ce que `gram init` génère)
ingredients:
  farine:
    name: "Farine tout usage"
    aliases: ["flour"]
    category: "Céréales"
    physical:
      density: 0.59       # g/mL — fait le pont entre unités de volume ("1 tasse") et masse
      yield: 1.0           # fraction (0, 1] — ratio net/brut après perte de préparation
      unit_weight: 120     # grammes par « unité » (ex : "1 farine" si jamais utilisé nu)
    nutrition:             # toutes les valeurs pour 100 g
      calories: 364
      protein: 10.3
      carbs: 76.3
      fat: 1.0
      sugar: 0.3
      fiber: 2.7
      sodium: 2

# Forme plate (ce qu'attendent directement validateIngredientDatabase()/analyze())
farine:
  name: "Farine tout usage"
  physical:
    density: 0.59
```

Les blocs `physical` et `nutrition` sont tous deux optionnels. Une entrée dépourvue des deux reste valide (elle ne remontera juste aucune donnée de masse/nutrition, ce qui déclenchera un `missingMassIngredients` ou un *warning* `MISSING_MACROS`). Seul le champ `name` est strictement requis. Les sous-champs `nutrition.calories`/`protein`/`carbs`/`fat` deviennent obligatoires dès l'instant où la clé `nutrition` est déclarée. Les autres (`sugar`, `fiber`, `sodium`, `sat_fat`, `mono_fat`, `poly_fat`, `alcohol`) sont optionnels.
