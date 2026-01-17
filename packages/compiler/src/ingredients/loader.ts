import { IngredientDbSchema, Ingredient, IngredientDb } from './schema';

// Import all data sources
import beverages from '../../../../data/beverages.yaml';
import dairy from '../../../../data/dairy.yaml';
import fatsOils from '../../../../data/fats-oils.yaml';
import fruitsVegetablesNuts from '../../../../data/fruits-vegetables-nuts.yaml';
import grainsCereals from '../../../../data/grains-cereals.yaml';
import meatsEggsFish from '../../../../data/meats-eggs-fish.yaml';
import pantryMisc from '../../../../data/pantry-misc.yaml';
import sugarsSweets from '../../../../data/sugars-sweets.yaml';
import userDefined from '../../../../data/user-defined.yaml';

export function loadIngredientDb(userRuntimeOverride?: Record<string, any>): Record<string, Ingredient> {
  const ingredientsMap: Record<string, Ingredient> = {};

  // List of sources to merge, in order.
  const sources = [
    { name: 'beverages', data: beverages },
    { name: 'dairy', data: dairy },
    { name: 'fats-oils', data: fatsOils },
    { name: 'fruits-vegetables-nuts', data: fruitsVegetablesNuts },
    { name: 'grains-cereals', data: grainsCereals },
    { name: 'meats-eggs-fish', data: meatsEggsFish },
    { name: 'pantry-misc', data: pantryMisc },
    { name: 'sugars-sweets', data: sugarsSweets },
    { name: 'user-defined', data: userDefined }, // Local user overrides (file-based)
  ];

  // 1. Process File-based DBs
  for (const source of sources) {
    if (!source.data) continue; // Skip empty files

    try {
      const result = IngredientDbSchema.safeParse(source.data);
      if (!result.success) {
        console.error(`Invalid Ingredient DB [${source.name}]:`, result.error.format());
        // We log but continue, allowing other partial data to load.
        // If a core file is completely busted, we might want to throw, but for now strict validation is only logged.
        continue;
      }
      Object.assign(ingredientsMap, result.data);
    } catch (e) {
      console.error(`Failed to load partial DB [${source.name}]:`, e);
    }
  }

  // 2. Process Runtime User DB (passed argument)
  // This allows the caller (e.g. playground component) to inject dynamic temporary overrides
  if (userRuntimeOverride) {
    try {
        const result = IngredientDbSchema.safeParse(userRuntimeOverride);
        if (!result.success) {
           console.error(`Invalid Runtime User Ingredient DB:`, result.error.format());
        } else {
           Object.assign(ingredientsMap, result.data);
        }
    } catch (e) {
        console.error('Failed to apply Runtime User DB override:', e);
    }
  }

  return ingredientsMap;
}

export function buildFastLookupMap(db: Record<string, Ingredient>): Record<string, Ingredient> {
    const lookup: Record<string, Ingredient> = {};

    for (const [canonicalName, data] of Object.entries(db)) {
        // Add canonical name
        lookup[canonicalName] = data;

        // Add aliases
        if (data.aliases) {
            for (const alias of data.aliases) {
                lookup[alias] = data;
            }
        }

        // Add i18n aliases
        if (data.i18n) {
            for (const val of Object.values(data.i18n)) {
                if (Array.isArray(val)) {
                    for (const alias of val) {
                        lookup[alias] = data;
                    }
                } else if (typeof val === 'string') {
                    lookup[val] = data;
                }
            }
        }
    }

    return lookup;
}
