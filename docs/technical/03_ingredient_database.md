# Ingredient Database

It is important to understand that the core language compiler (`@gram/kitchen`) **does not** need an ingredient database. It only validates the syntax and builds the structural AST of the recipe.

The ingredient database is exclusively used by the **`@gram/analyzer`** (an optional layer). The analyzer "overloads" and enriches the recipes with physical mass normalization, yield adjustments, and nutritional estimation, **if and only if** a database is provided.

## 1. Database Architecture (The "Host" Pattern)

Because Gram is designed to be environment-agnostic, the analyzer does not know how to read files or make HTTP requests. 

The **host application** (such as the VS Code extension, the Playground, or a custom server CLI) is responsible for providing this data. It acts as an adapter:

*   **VS Code Extension / Local Projects:** The extension (the "host") looks for a `.gram/ingredients.yaml` file in the user's workspace. The extension reads this file and passes it to the analyzer.
*   **Playground / Web:** The playground (the "host") passes a hardcoded JSON object or fetches data from an API.
*   **Custom Backend:** A Node.js backend might query a real database (like PostgreSQL) and pass the result to the analyzer.

In all cases, the host must pass the data as a JavaScript object/dictionary to the `analyze` function of `@gram/analyzer`.

A complete YAML fixture example is available in `packages/analyzer/tests/fixtures/ingredients.yaml` which serves as the Living Documentation for the expected schema.

### 1.1. Schema Specification

To avoid outdated documentation, we do not hardcode the full YAML schema here. Instead, GRAM relies on **Living Documentation**. 

The definitive, always-up-to-date schema reference is the tested fixture file located at:
**[`packages/analyzer/tests/fixtures/ingredients.yaml`](../../../packages/analyzer/tests/fixtures/ingredients.yaml)**

Each ingredient in this database maps internally to the `IngredientData` type defined and validated by Zod in `packages/analyzer/src/schemas.ts`. If you are building a host application, your provided database must pass this Zod validation.

---

## 2. Resolution & Multilingual Units

*   **Ingredients Resolution (Aliases)**: Ingredients are resolved primarily by their exact string match. However, the database supports an `aliases` array. This allows the analyzer to map variations (like `@dijon mustard` or `@yellow mustard`) back to the canonical `mustard` object in the user's custom database.
*   **Units Normalization (I18n)**: While ingredient names are specific to the user's language, **volume and mass units are natively normalized across languages** by the `@gram/i18n` package. For example, French volume units like `càs` (tablespoon) and `càc` (teaspoon) are automatically resolved to their canonical equivalents (`tbsp`, `tsp`) internally.

---

## 3. Host Loading Process

1.  **Node.js / Host Environment**: The host application reads the database from its own data source (YAML files, JSON, REST APIs) and passes the unified object to the analyzer.
2.  **Playground (Web Environment)**: The playground uses a local version of the database.
