# Ingredient Database

Gram relies on file-based ingredient database to provide mass normalization (density conversion) and nutritional estimation.

## Structure

The database is built from individual YAML files located in `data/`. This allows for easy categorization and maintenance.

### File Organization
*   **Categories**: Main ingredients are split by category (e.g., `data/dairy.yaml`, `data/grains-cereals.yaml`).
*   **User Overrides**: A special file `data/user-defined.yaml` is reserved for user-specific ingredients or overrides. It is loaded last, so it takes precedence.

### Data Schema

Each ingredient entry in the YAML files follows this schema:

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
    yield: 0.85        # Edible portion factor
    
  # Nutritional Data (Macronutrients)
  states:
    default:
      macros:
        kcal: 100
        protein: 10
        fat: 5
        carbs: 20
        # ... sugar, fiber, sodium
    canned:
      macros:
        # ... (values for cooked state)
```

## Data Sources

The core database is populated using high-quality data from official sources, augmented by AI for coverage:

1.  **CIQUAL (France)**: ANSES French Food Composition Table (2025). Primary source for metric values and French ingredients.
2.  **USDA (USA)**: FoodData Central. Primary source for imperial/US-centric ingredients.
3.  **LLM Augmentation**: Where data is missing or specific densities are hard to find in databases, values have been estimated by Large Language Models (labeled with `# [LLM]`).

## Internationalization (I18n)

The database and compiler natively support multilingual lookups for both ingredients and units.

*   **Ingredients**: You can write `@oeuf` (French) or `@egg` (English). The compiler normalizes both to the canonical key (`egg`) using the `i18n` map.
*   **Units**: Common unit abbreviations are also localized. For example, French volume units like `càs` (tablespoon) and `càc` (teaspoon) are automatically resolved to their canonical equivalents (`tbsp`, `tsp`) to enable density-based mass calculation.
*   This allows recipes to be written in different languages while sharing the same underlying nutritional/physical data.

## Loading Process

1.  **Compiler (Core)**: In a Node.js environment, the compiler loads all YAML files from the `data/` directory at startup.
2.  **Playground (Web)**: To optimize performance, the database is bundled into a separate chunk (`dist/chunks/db_bundle.js`). The app lazy-loads this bundle only when needed, keeping the initial page load fast.
