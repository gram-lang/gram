import { Ingredient } from './schema';
export declare function loadIngredientDb(userDbOverride?: Record<string, any>): Record<string, Ingredient>;
export declare function buildFastLookupMap(db: Record<string, Ingredient>): Record<string, Ingredient>;
