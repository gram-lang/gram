# Formats de Données

Les formes JSON qui circulent entre les étapes du pipeline, et le schéma YAML de la base de données d'ingrédients. Cette page complète les références par paquet — c'est le compagnon « à quoi ressemblent réellement les données » de leur contenu « quelles fonctions existent ».

## 1. L'AST (`@gram-lang/parser`)

Pour cette source :

```gram
---
title: 'Crêpes'
---

## Pâte

Mélanger @farine{200g} et @lait{200ml}.
```

`getAST()` retourne (annoté, les décalages `loc` omis pour la lisibilité — chaque nœud sauf `RecipeAST` lui-même en porte un) :

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

Voir [parser.md](/fr/reference/api/parser) pour l'ensemble complet des interfaces de nœuds et l'énumération `ASTNodeType`.

## 2. Recettes compilées & analysées (`@gram-lang/kitchen`, `@gram-lang/analyzer`)

`compile()` produit un `CompilationResult` ; `analyze()` retourne cette même forme enrichie de champs masse/nutrition (`AnalyzedCompilationResult`). Différence ci-dessous — les champs propres à l'analyseur sont marqués :

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

Remarquez le vocabulaire `StepToken` du compilateur à l'intérieur de `content` : le texte narratif simple est une `string` brute ; les ingrédients/matériel/références partagent la forme `Usage` (pas de champ `type`, identifiés par la présence d'un `id`) ; les minuteurs/températures/commentaires/déclarations portent chacun leur propre `type` en minuscules. C'est volontairement distinct du `ASTNodeType` en PascalCase du parser — cela décrit la *sortie* compilée, pas l'entrée parsée. Voir [Créer une UI personnalisée](/fr/how-to/build-custom-ui) pour un tutoriel de consommation de cette forme dans un framework frontend.

## 3. Base de données d'ingrédients (YAML)

La base de données passée à `validateIngredientDatabase()` / `analyze()` est un `Record<string, IngredientData>` plat, indexé par slug d'ingrédient. Le CLI `gram` accepte en plus (et déballe) une clé optionnelle `ingredients:` de premier niveau, si bien que ces deux fichiers `.gram/ingredients.yaml` sont valides :

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

`physical` et `nutrition` sont tous deux optionnels — une entrée sans aucun des deux reste valide (elle ne contribue simplement aucune donnée de masse/nutrition, ce qui apparaît comme `missingMassIngredients` / un avertissement `MISSING_MACROS`). Seul `name` est requis. `nutrition.calories`/`protein`/`carbs`/`fat` sont requis dès que `nutrition` est présent ; `sugar`/`fiber`/`sodium`/`sat_fat`/`mono_fat`/`poly_fat`/`alcohol` sont tous optionnels.
