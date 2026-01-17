import { Ingredient } from './schema';
export declare function loadIngredientDb(sources?: Array<{
    name: string;
    data: any;
}>): Record<string, Ingredient>;
export declare function buildFastLookupMap(db: Record<string, Ingredient>): Record<string, Ingredient>;
