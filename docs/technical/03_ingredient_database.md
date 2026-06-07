# Ingredient Database

The `@gram/analyzer` queries an external ingredient database to perform physical mass normalization, yield adjustments, and nutritional estimation. 

## 1. Database Architecture

The host application (such as the Playground or a custom server CLI) is responsible for loading the database from files and passing it directly as a JavaScript object/dictionary to the `analyze` function of `@gram/analyzer`. 

By default, in the GRAM monorepo, the reference database is compiled from individual YAML files in the `data/` directory.

### 1.1. Schema Specification

Each ingredient in the database maps to the `IngredientData` type:

```yaml
canonical-slug:
  name: "Canonical Name"
  i18n:
    fr: "Nom Français"
    es: "Nombre Español"
  aliases: ["common alias", "other name"]
  tags: ["category", "tag"]
  
  # Physical Properties (Mass/Volume conversion)
  physical:
    density: 0.92      # g/ml
    unit_weight: 55    # g (default weight for 1 unit)
    yield: 0.85        # Edible portion factor (Yield percentage)
    
  # Nutritional Data (Macronutrients per 100g)
  states:
    default:
      macros:
        kcal: 100
        protein: 10
        fat: 5
        carbs: 20
        sugar: 5
        fiber: 2
        sodium: 0.1
```

> [!NOTE]  
> While the database schema supports a `states` map (for raw vs. cooked macros) for long-term extensibility, the deprecated `:state` text syntax has been removed from the parser and compiler to keep the grammar pure and focused strictly on raw text recipes. All database queries default to the `"default"` state.

---

## 2. Multilingual Support (I18n)

The database enables full localized lookups for ingredients:

*   **Ingredients Resolution**: You can write `@oeuf` (French) or `@egg` (English) in your recipe text. The `@gram/analyzer` normalizes both to the canonical key `egg` using the database's `i18n` mapping.
*   **Units Normalization**: Volume units are normalized across languages. For example, French volume units like `càs` (tablespoon) and `càc` (teaspoon) are resolved to their canonical equivalents (`tbsp`, `tsp`) internally.

---

## 3. Host Loading Process

1.  **Node.js / Host Environment**: The host application reads the YAML files from the `data/` directory at startup and merges them. The `user-defined.yaml` overrides file should be loaded last to take precedence.
2.  **Playground (Web Environment)**: The database is pre-bundled into a separate chunk (`dist/chunks/db_bundle.js`) to keep the initial page loading times extremely fast. The playground app lazy-loads the database bundle only when the analyzer is active.
