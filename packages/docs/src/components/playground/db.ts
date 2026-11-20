// The ingredient database of the playground examples. Its source is
// `ingredients.yaml`, the same file a Gram project keeps: the data is read at
// build time (the `yamlData` Vite plugin in astro.config.mjs, Bun's own YAML
// loader in tests). Its text is shown, as is, by `GramDatabase.vue`.
import type { IngredientData } from "@gram-lang/analyzer";
import data from "./ingredients.yaml";

export const EXAMPLE_DATABASE = data as Record<string, IngredientData>;

/** The tab that shows the database, beside the recipe files. */
export const DATABASE_TAB = "ingredients.yaml";
