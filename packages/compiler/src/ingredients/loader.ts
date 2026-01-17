import { IngredientDbSchema, Ingredient, IngredientDb } from './schema';

export function loadIngredientDb(sources: Array<{ name: string, data: any }> = []): Record<string, Ingredient> {
  const ingredientsMap: Record<string, Ingredient> = {};

  // 1. Process File-based DBs
  for (const source of sources) {
    if (!source.data) continue; // Skip empty files

    try {
      const result = IngredientDbSchema.safeParse(source.data);
      if (!result.success) {
        console.error(`Invalid Ingredient DB [${source.name}]:`, result.error.format());
        continue;
      }
      Object.assign(ingredientsMap, result.data);
    } catch (e) {
      console.error(`Failed to load partial DB [${source.name}]:`, e);
    }
  }

  return ingredientsMap;
}

import { slugify } from '../utils';

export function buildFastLookupMap(db: Record<string, Ingredient>): Record<string, Ingredient> {
    const lookup: Record<string, Ingredient> = {};

    for (const [canonicalName, data] of Object.entries(db)) {
        // Add canonical name
        lookup[slugify(canonicalName)] = data;

        // Add aliases
        if (data.aliases) {
            for (const alias of data.aliases) {
                lookup[slugify(alias)] = data;
            }
        }

        // Add i18n aliases
        if (data.i18n) {
            for (const val of Object.values(data.i18n)) {
                if (Array.isArray(val)) {
                    for (const alias of val) {
                        lookup[slugify(alias)] = data;
                    }
                } else if (typeof val === 'string') {
                    lookup[slugify(val)] = data;
                }
            }
        }
    }

    return lookup;
}
