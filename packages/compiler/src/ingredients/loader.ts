import { IngredientDbSchema, Ingredient, IngredientDb } from './schema';
import coreRawDb from '../../../../data/ingredients.yaml';

export function loadIngredientDb(userDbOverride?: Record<string, any>): Record<string, Ingredient> {
  const ingredientsMap: Record<string, Ingredient> = {};

  // 1. Process Core DB
  try {
    const result = IngredientDbSchema.safeParse(coreRawDb);
    if (!result.success) {
      console.error(`Invalid Core Ingredient DB:`, result.error.format());
      // In a crash situation, we might want to throw, but let's try to proceed or just throw
      throw new Error(`Core DB validation failed`);
    }
    Object.assign(ingredientsMap, result.data);
  } catch (e) {
    console.error('Failed to load Core DB:', e);
    // If core fails, we are in trouble.
    throw e;
  }

  // 2. Process User DB (Override)
  if (userDbOverride) {
    try {
        const result = IngredientDbSchema.safeParse(userDbOverride);
        if (!result.success) {
           console.error(`Invalid User Ingredient DB:`, result.error.format());
           // Depending on policy, we might ignore invalid user db or throw. 
           // Let's log and ignore only the invalid parts? No, safeParse fails entirely for the Record map if one entry is wrong?
           // Actually Zod Record validates all values. If one is wrong, strict mode?
           // Let's just log error and allow clean partial merge if possible? 
           // For now, simple block override if invalid.
        } else {
           Object.assign(ingredientsMap, result.data);
        }
    } catch (e) {
        console.error('Failed to apply User DB override:', e);
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
            for (const lang of Object.values(data.i18n)) {
                if (Array.isArray(lang)) {
                    for (const alias of lang) {
                        lookup[alias] = data;
                    }
                }
            }
        }
    }

    return lookup;
}
