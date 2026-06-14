# Development Environment & Architecture

This document is intended for developers, contributors, and curious users who want to understand how the GRAM project is built, validated, and tested.

## 1. Technology Stack

GRAM is built with modern, lightweight tools designed for speed and reliability:
*   **[TypeScript](https://www.typescriptlang.org/)**: The entire codebase is strongly typed.
*   **[Bun](https://bun.sh/)**: We use Bun as our primary runtime, package manager, and test runner. It replaces Node, npm/pnpm, and Jest/Vitest, offering blazing fast performance.
*   **[OhmJS](https://ohmjs.org/)**: The parser is powered by OhmJS, an object-oriented parsing toolkit. It cleanly separates the grammar definition (`.ohm` logic) from the semantic actions (how the AST is built).

## 2. Monorepo Architecture

The project is structured as a monorepo containing several interconnected packages:

*   **`@gram/parser`**: The core. It takes a raw string, matches it against the Ohm grammar, and produces a purely structural Abstract Syntax Tree (AST).
*   **`@gram/compiler`**: The logic layer. It takes the AST from the parser and resolves variables, schedules timers, detects business errors (warnings), and aggregates the shopping list.
*   **`@gram/analyzer`**: The physical layer. It connects the compiled recipe to an external ingredient database to normalize units (e.g., converting "1 cup of flour" to "120g") and estimate nutritional values.
*   **`@gram/i18n`**: Centralizes translation dictionaries and unit mappings across languages.

> [!TIP]
> **Why strict separation?**
> This architecture ensures watertight boundaries. A user building a simple syntax highlighter only needs `@gram/parser`. A user building a complex meal-planner will use `@gram/compiler` and `@gram/analyzer`.

## 3. Data Validation with Zod

We use **[Zod](https://zod.dev/)** to guarantee runtime type safety when interacting with external data (such as user-provided databases or compiler options).

### The "Single Source of Truth" pattern
All data schemas (like `IngredientDataSchema`) are defined in `schemas.ts` files within each package. Types are then inferred directly from these schemas:
```typescript
export const IngredientDataSchema = z.object({ name: z.string(), ... });
export type IngredientData = z.infer<typeof IngredientDataSchema>;
```
If an external YAML file is loaded by the analyzer, it is immediately parsed through this Zod schema. If the YAML has a typo or the wrong type, it crashes cleanly before the program even tries to use it.

## 4. Testing Philosophy

### Snapshot Testing (`bun:test`)
Because GRAM acts as a compiler (translating text to a JSON tree), writing manual assertions like `expect(result.sections[0].ingredients[0].name).toBe("flour")` is extremely tedious and fragile.

Instead, we use **Snapshot Testing**.
1. We write dummy `.gram` files in `tests/fixtures/valid/`.
2. The test runner compiles them and saves the resulting JSON in a `__snapshots__` directory.
3. On future runs, it compares the new JSON output against the saved snapshot.

> [!WARNING]
> If you modify the grammar or the compiler logic, the JSON output might legitimately change. Bun will fail the test and show you a diff. If the change was intended, simply run `bun test --update-snapshots` to lock in the new behavior.

### Living Documentation
We avoid "dead" documentation files. For example, the reference YAML format is stored as an actual file (`packages/analyzer/tests/fixtures/ingredients.yaml`). A dedicated Bun test parses this file and validates it against our Zod schema. This ensures the example we provide to users is always 100% valid and up-to-date with the code.
