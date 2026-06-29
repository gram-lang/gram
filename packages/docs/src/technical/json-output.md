# GRAM JSON Output Schema

GRAM generates a highly optimized, minified, **registry-based** JSON structure to avoid data redundancy and minimize payload size for consumer applications.

---

## 1. Global Structural Outputs

The system distinguishes between two output payloads: the **Compiled AST** (from `@gram/kitchen`) and the **Analyzed AST** (from `@gram/analyzer`).

### 1.1. Pure Compiled Output Schema (`@gram/kitchen`)

The core compiler returns a clean structural model of the recipe:

```json
{
  "title": "Recipe Title",
  "slug": "recipe-title",
  "meta": { ... },         // Frontmatter data
  "registry": { ... },     // deduplicated dictionary of items
  "shopping_list": [ ... ],// Aggregated list (pure quantities)
  "cookware": [ ... ],     // Aggregated cookware list
  "sections": [ ... ],     // Cooking steps and local ingredient usage
  "warnings": [ ... ],     // Validation warnings (if any)
  "metrics": {             
     "totalTime": 120,     // Total elapsed duration in minutes
     "activeTime": 45,     // Active work labor in minutes
     "preparationTime": 10 // Estimated base prep overhead in minutes
  }
}
```

### 1.2. Enriched Analyzed Output Schema (`@gram/analyzer`)

The analyzer enriches the compiled output with physical, density, and nutritional properties:

```json
{
  ...
  "metrics": {
     "totalTime": 120,
     "activeTime": 45,
     "preparationTime": 10,
     "totalMass": 1250,    // Total raw mass in grams
     "massStatus": "estimated", // 'precise' | 'estimated' | 'incomplete'
     "missingMassIngredients": [ ... ],
     "nutrition": {        // Estimated calories & macros (total for the recipe)
         "calories": 2500,
         "protein": 85,
         "carbs": 310,
         "fat": 95,
         "sugar": 40,       // optional
         "fiber": 12,       // optional
         "sodium": 3.5,     // optional — summed from ingredient sodium values (g)
         "isEstimate": true,// true if any ingredient lacked full nutrition data
         "coverage": 0.87,  // fraction of recipe mass covered by DB nutrition data
         "warnings": [],    // array of warning strings if coverage is partial
         "perPortion": {    // present if AnalyzerOptions.portions > 1
             "calories": 625,
             "protein": 21,
             "carbs": 77,
             "fat": 24,
             "sugar": 10,
             "fiber": 3,
             "sodium": 0.9
         }
     }
  }
}
```

---

## 2. The Registry (`registry`)

The registry deduplicates ingredients and cookware. The rest of the JSON structure refers to these items purely by their slug-like `id`.

```json
"registry": {
  "ingredients": {
    "flour": {
      "id": "flour",
      "name": "flour",
      "default_unit": "g"
    }
  },
  "cookware": {
    "pan": {
      "id": "pan",
      "name": "pan"
    }
  }
}
```

---

## 3. Minified Usage Objects

Ingredient and cookware usages inside steps or lists are strictly minified to reduce payload sizes:

| Key | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | **Required**. References a key in the Registry. |
| `qty` | `number` \| `object` | Quantity value. Defered formula object if relative. |
| `unit` | `string` | Unit text (e.g. "g", "ml"). |
| `preparation` | `string` | Preparation instructions from parentheses `(chopped)`. |
| `modifiers` | `string[]` | Flags: `"optional"`, `"reference"`, `"hidden"`, `"bakers_percentage"`. |
| `normalizedMass` | `number` | *Analyzed Only*. Physical mass in grams. |
| `isEstimate` | `boolean` | *Analyzed Only*. `true` if mass is derived using density conversions. |
| `conversionMethod`| `string` | *Analyzed Only*. Conversion type (`'physical'`, `'density'`, etc.). |
| `formula` | `object` | Dynamic relative formula details: `{ raw, target, percent, isGhost }`. |

---

## 4. Sections & Steps

Recipe execution steps are laid out in a hierarchical section map:

```json
"sections": [
  {
    "title": "Dough",
    "retro_planning": "2d", // Optional: e.g. T-2d
    "ingredients": [ ... ], // Stack of ingredients in this section
    "steps": [
      {
        "type": "step",
        "action": "Mix",    
        "timings": {
           "start": 0,
           "end": 5,
           "activeDuration": 5
        },
        "backgroundTasks": [],
        "content": [        // Mixed narrative and usages
          "Combine the ",
          { "id": "flour", "qty": 200, "unit": "g" },
          " in a bowl."
        ]
      }
    ]
  }
]
```

---

## 5. Shopping List

The `shopping_list` aggregates requirements globally:

| Key | Type | Description |
| :--- | :--- | :--- |
| `id` | `string` | Semantic ID. |
| `name` | `string` | Display name. |
| `qty` | `number` | Main certifiable scalar quantity. |
| `unit` | `string` | Unit for the main quantity. |
| `normalizedMass` | `number` | *Analyzed Only*. Mass sum in grams. |
| `purchasingMass` | `number` | *Analyzed Only*. Purchasing mass (Gross Mass) under yield metrics. |
| `variable_entries`| `string[]`| Mixed unit entries or relative formula display strings. |
